import React, { useState, useEffect } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Zap, 
  AlertTriangle,
  History,
  FileText
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Inventory', path: '/parts', icon: Package },
    { label: 'Sales (POS)', path: '/billing', icon: Zap },
    { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
    { label: 'Invoices', path: '/invoices', icon: FileText, requiredRole: Role.OWNER },
    { label: 'Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
  ];

  return (
    <div className="h-screen bg-[#F8FAFC] flex overflow-hidden">
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR - Ergonomic Density */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <Package size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Sparezy</span>
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">
             <X size={24} />
           </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 no-scrollbar">
           {navItems.map((item, idx) => {
              if (item.requiredRole && user.role !== item.requiredRole) return null;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={idx}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-brand-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
           })}
        </nav>

        <div className="p-4 border-t border-white/5">
           <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white uppercase">
                 {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black">{user.role}</p>
              </div>
              <button onClick={onLogout} className="p-2 text-slate-500 hover:text-rose-400 transition-colors">
                 <LogOut size={18} />
              </button>
           </div>
        </div>
      </aside>

      {/* MAIN SECTION */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* MOBILE HEADER - Ergonomic & Persistent */}
        <header className="lg:hidden flex-none h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-60 safe-top">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 -ml-2 text-slate-900 active:scale-90 transition-all"
                >
                    <Menu size={24} />
                </button>
                <span className="font-bold text-lg tracking-tight">Sparezy</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {user.name.charAt(0)}
                </div>
            </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
           <div className="max-w-4xl mx-auto p-4 lg:p-10 safe-bottom">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;