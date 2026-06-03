
import React, { useState, useCallback, useMemo } from 'react';
// @ts-ignore
import { Link, useLocation } from 'react-router-dom';
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
  X, 
  Zap,
  RefreshCw,
  PieChart,
  Bell,
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGlobalRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => { window.location.reload(); }, 600);
  }, []);

  const navGroups = useMemo(() => [
    {
      title: 'Operational Hub',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Parts Inventory', path: '/parts', icon: Package },
        { label: 'Transaction Ledger', path: '/movements', icon: History },
        { label: 'Tasks & Reminders', path: '/tasks', icon: Bell },
      ]
    },
    {
      title: 'Counter & Sales',
      items: [
        { label: 'Point of Sale', path: '/billing', icon: Zap },
        { label: 'Returns Processor', path: '/billing?tab=return', icon: ArrowRightLeft },
      ]
    },
    {
      title: 'Supply Chain',
      items: [
        { label: 'Purchase Inbound', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
        { label: 'Management Approvals', path: '/approvals', icon: CheckSquare, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Administration',
      items: [
        { label: 'Critical Alerts', path: '/low-stock', icon: AlertTriangle },
        { label: 'Bulk Data Tools', path: '/import-export', icon: FileUp, requiredRole: Role.OWNER },
        { label: 'Profit Intelligence', path: '/profit-analysis', icon: PieChart, requiredRole: Role.OWNER },
        { label: 'Analytics Centre', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
        { label: 'System Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ], []);

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden font-['Plus_Jakarta_Sans']">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 z-[70] lg:hidden backdrop-blur-sm transition-all duration-300" onClick={() => setIsSidebarOpen(false)}/>}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[80] w-[280px] bg-white border-r border-slate-300 flex flex-col transform transition-all duration-300 ease-in-out shadow-elevated h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-20 flex-none flex items-center justify-between px-6 border-b border-slate-200">
           <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Package size={20} strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-extrabold text-slate-950 tracking-tighter uppercase">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-10 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-4">
                <h3 className="px-4 text-[10px] font-extrabold text-slate-900 uppercase tracking-[0.2em]">{group.title}</h3>
                <div className="space-y-1.5">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link key={itemIdx} to={item.path} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[14px] font-bold transition-all duration-200 group active:scale-[0.97] ${isActive ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                          <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-950'}`} />
                          <span className="tracking-tight">{item.label}</span>
                          {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-4 flex-none border-t border-slate-200 bg-slate-50">
           <div className="relative">
             <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border-2 border-slate-200 shadow-soft hover:border-slate-400 transition-all text-left group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg ${user.role === Role.OWNER ? 'bg-slate-950' : 'bg-blue-700'}`}>
                   {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-950 truncate uppercase tracking-tight">{user.name}</p>
                    <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest">{user.role}</p>
                </div>
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
             </button>
             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-white rounded-2xl shadow-elevated border-2 border-slate-200 overflow-hidden animate-slide-up z-[100] p-1.5">
                  <button onClick={onLogout} className="w-full text-left px-4 py-4 text-[11px] text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-3 font-extrabold uppercase tracking-[0.1em] transition-all">
                     <LogOut size={18} strokeWidth={2.5} /> Log Out System
                  </button>
               </div>
             )}
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden fixed top-4 left-4 z-[60] p-3.5 bg-white shadow-elevated border-2 border-slate-200 rounded-2xl text-slate-900 active:scale-95 transition-all"><Menu size={24} strokeWidth={2.5} /></button>
        <button onClick={handleGlobalRefresh} className="fixed top-4 right-4 z-[60] p-3.5 bg-white shadow-elevated border-2 border-slate-200 rounded-2xl text-slate-500 hover:text-blue-700 transition-all active:rotate-180 duration-500" title="Refresh Session"><RefreshCw size={22} className={isRefreshing ? 'animate-spin text-blue-600' : ''} /></button>
        <main className="flex-1 overflow-y-auto px-4 lg:px-12 py-8 pt-24 lg:pt-10 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(Layout);
