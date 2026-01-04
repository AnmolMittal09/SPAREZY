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

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => e.preventDefault();
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
          className="fixed inset-0 bg-slate-900/60 z-[70] lg:hidden backdrop-blur-xl transition-all duration-700"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-[300px] glass-card border-r border-white/20 flex flex-col transform transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarOpen ? 'translate-x-0 shadow-[40px_0_80px_rgba(0,0,0,0.3)]' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-28 flex items-center justify-between px-10 border-b border-white/10">
           <Link to="/" className="flex items-center gap-5 group" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-14 h-14 bg-gradient-to-tr from-brand-700 to-brand-400 rounded-2xl flex items-center justify-center text-white shadow-3d group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <Package size={28} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-slate-900 tracking-tighter">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-4 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all active:scale-90">
             <X size={32} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-10 space-y-12 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-4">
                <h3 className="px-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {group.title}
                </h3>
                
                <div className="space-y-2">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-5 px-5 py-4 rounded-3xl text-[15px] font-bold transition-all duration-500 group relative overflow-hidden ${
                            isActive 
                              ? 'bg-slate-900 text-white shadow-3d translate-x-2' 
                              : 'text-slate-600 hover:bg-white hover:shadow-soft hover:translate-x-2'
                          }`}
                        >
                          <item.icon 
                            size={22} 
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors duration-500 ${isActive ? 'text-brand-400' : 'text-slate-400 group-hover:text-brand-500'}`} 
                          />
                          <span>{item.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2.5 h-2.5 rounded-full bg-brand-400 shadow-[0_0_15px_#0ea5e9] animate-pulse" />
                          )}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-8 border-t border-white/10">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-5 p-4 rounded-4xl bg-white/50 border border-white/40 hover:bg-white hover:shadow-3d hover:-translate-y-2 transition-all duration-500 text-left group shadow-inner-3d"
             >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-3d transform group-hover:scale-110 transition-transform ${user.role === Role.OWNER ? 'bg-indigo-600' : 'bg-brand-600'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
                </div>
                <ChevronDown size={20} className={`text-slate-300 transition-transform duration-700 ${showUserMenu ? 'rotate-180 text-brand-500' : ''}`} />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-6 bg-white rounded-4xl shadow-3d border border-slate-100 overflow-hidden animate-slide-up z-50 p-3">
                  <button onClick={onLogout} className="w-full text-left px-6 py-5 text-[15px] text-rose-600 hover:bg-rose-50 rounded-3xl flex items-center gap-5 font-black transition-all active:scale-95">
                     <LogOut size={24} /> Sign Out
                  </button>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* MAIN SECTION */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Nav Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-24 bg-white/70 backdrop-blur-2xl border-b border-white/20 z-[60] flex items-center px-8 shadow-soft">
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-14 h-14 bg-white shadow-3d border border-slate-100 rounded-2xl text-slate-900 active:scale-90 transition-all flex items-center justify-center"
            >
                <Menu size={32} />
            </button>
            <span className="ml-6 text-2xl font-black text-slate-900 tracking-tighter">Sparezy</span>
        </div>

        {/* MAIN CONTENT Area */}
        <main className="flex-1 overflow-y-auto px-8 lg:px-14 py-10 pt-32 lg:pt-14 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto pb-32">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;