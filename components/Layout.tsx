import React, { useState } from 'react';
// @ts-ignore
import { Link, useLocation } from 'react-router-dom';
import { User, Role } from '../types';
import { 
  LayoutDashboard, Package, ShoppingBag, ClipboardList, 
  ArrowRightLeft, AlertTriangle, FileUp, BarChart3, Settings, 
  LogOut, Menu, X, Zap, CheckSquare, FileText, ChevronRight
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navGroups = [
    {
      title: 'Operations',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Inventory', path: '/parts', icon: Package },
        { label: 'POS Terminal', path: '/billing', icon: Zap },
      ]
    },
    {
      title: 'Inbound / Outbound',
      items: [
        { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
        { label: 'Approvals', path: '/approvals', icon: CheckSquare, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Administration',
      items: [
        { label: 'Tax Invoices', path: '/invoices', icon: FileText, requiredRole: Role.OWNER },
        { label: 'Bulk Tools', path: '/import-export', icon: FileUp, requiredRole: Role.OWNER },
        { label: 'Analytics', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
        { label: 'Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ];

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-500 rounded flex items-center justify-center text-white font-black text-lg">S</div>
              <span className="text-xl font-bold tracking-tight">Sparezy</span>
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto p-1">
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-1">
                <h3 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {group.title}
                </h3>
                {group.items.map((item, itemIdx) => {
                  if (item.requiredRole && user.role !== item.requiredRole) return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={itemIdx}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={18} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
             </div>
           ))}
        </div>

        <div className="p-4 border-t border-white/5">
           <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <div className="w-9 h-9 rounded bg-brand-500 flex items-center justify-center font-bold uppercase">{user.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate leading-none mb-1">{user.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black">{user.role}</p>
              </div>
              <button onClick={onLogout} className="p-2 text-slate-500 hover:text-rose-400"><LogOut size={16} /></button>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-60">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-900">
                <Menu size={24} />
            </button>
            <span className="font-bold text-lg">Sparezy</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs uppercase text-slate-500">{user.name.charAt(0)}</div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative">
           <div className="max-w-7xl mx-auto p-4 lg:p-8 safe-bottom">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;