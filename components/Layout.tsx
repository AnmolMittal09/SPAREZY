
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { fetchTasks, markTaskReminderSent } from '../services/taskService';
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
  PieChart,
  Bell,
  History,
  ShieldCheck,
  Clock
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
    setTimeout(() => {
      window.location.reload();
    }, 600);
  }, []);

  // Memoize navGroups to avoid re-calculating on every render
  const navGroups = useMemo(() => [
    {
      title: 'Navigation',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Inventory', path: '/parts', icon: Package },
        { label: 'Trans. History', path: '/movements', icon: History },
        { label: 'Tasks & Reminders', path: '/tasks', icon: Bell },
      ]
    },
    {
      title: 'Counter & Sales',
      items: [
        { label: 'Point of Sale', path: '/billing', icon: Zap },
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
  ], []);

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-['Plus_Jakarta_Sans']">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-sm transition-all duration-300" onClick={() => setIsSidebarOpen(false)}/>}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[80] w-[280px] bg-white border-r border-slate-200/60 flex flex-col transform transition-all duration-300 ease-in-out shadow-soft h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex-none flex items-center justify-between px-6 border-b border-slate-50">
           <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Package size={16} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tighter uppercase">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-3">
                <h3 className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] opacity-80">{group.title}</h3>
                <div className="space-y-1">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link key={itemIdx} to={item.path} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-200 group active:scale-[0.97] ${isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                          <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                          <span className="tracking-tight">{item.label}</span>
                          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-4 flex-none border-t border-slate-100 bg-slate-50/30">
           <div className="relative">
             <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 shadow-soft hover:border-blue-200 transition-all text-left group active:scale-[0.98]">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg ${user.role === Role.OWNER ? 'bg-slate-900' : 'bg-blue-600'}`}>
                   {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-900 truncate uppercase tracking-tight">{user.name}</p>
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-0.5">{user.role}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-500 ${showUserMenu ? 'rotate-180' : ''}`} />
             </button>
             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-white rounded-2xl shadow-elevated border border-slate-100 overflow-hidden animate-slide-up z-[100] p-1.5">
                  <button onClick={onLogout} className="w-full text-left px-4 py-3 text-xs text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 font-black uppercase tracking-widest transition-all">
                     <LogOut size={16} strokeWidth={2.5} /> Sign Out Terminal
                  </button>
               </div>
             )}
           </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden fixed top-4 left-4 z-[60] p-3 bg-white shadow-premium border border-slate-200 rounded-2xl text-slate-600 active:scale-95 transition-all"><Menu size={20} /></button>
        <button onClick={handleGlobalRefresh} className="fixed top-4 right-4 z-[60] p-3 bg-white shadow-premium border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all active:rotate-180 duration-700" title="Refresh Session"><RefreshCw size={20} className={isRefreshing ? 'animate-spin text-blue-600' : ''} /></button>
        <main className="flex-1 overflow-y-auto px-4 lg:px-10 py-6 pt-20 lg:pt-8 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(Layout);
