
import React from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { 
  LayoutDashboard, 
  Car, 
  Upload, 
  LogOut, 
  Menu, 
  X,
  PackageSearch,
  ShoppingCart,
  ChevronRight,
  Users
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, themeColor = 'blue' }: { to: string, icon: any, label: string, themeColor?: 'blue' | 'red' | 'gray' }) => {
    const active = isActive(to);
    
    let activeClass = 'bg-blue-600 text-white shadow-md shadow-blue-200';
    let inactiveClass = 'text-gray-600 hover:bg-gray-100';

    if (themeColor === 'red') {
        activeClass = 'bg-red-600 text-white shadow-md shadow-red-200';
        inactiveClass = 'text-gray-600 hover:bg-red-50 hover:text-red-700';
    } else if (themeColor === 'blue') {
         activeClass = 'bg-blue-900 text-white shadow-md shadow-blue-200';
         inactiveClass = 'text-gray-600 hover:bg-blue-50 hover:text-blue-900';
    }

    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
          active ? activeClass : inactiveClass
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <Icon size={20} className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="font-medium">{label}</span>
        {active && <ChevronRight size={16} className="ml-auto opacity-50" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-8 border-b border-gray-100 flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
              <div className="bg-slate-900 text-white p-1.5 rounded-lg">
                <PackageSearch size={24} />
              </div>
              Sparezy
            </h1>
            <p className="text-xs text-gray-500 font-medium pl-10">
              Stock Management System
            </p>
          </div>

          <div className="px-6 py-4">
             <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${user.role === Role.OWNER ? 'bg-indigo-600' : 'bg-teal-600'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{user.role}</p>
                </div>
                <button 
                    onClick={onLogout}
                    title="Sign Out"
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                    <LogOut size={18} />
                </button>
             </div>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Main Menu</p>
            <NavItem to="/" icon={LayoutDashboard} label="Overview" themeColor="gray" />
            <NavItem to="/transactions" icon={ShoppingCart} label="Daily Transactions" themeColor="gray" />
            
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-6 mb-2">Inventory</p>
            <NavItem to="/brand/hyundai" icon={Car} label="Hyundai Stock" themeColor="blue" />
            <NavItem to="/brand/mahindra" icon={Car} label="Mahindra Stock" themeColor="red" />
            
            {user.role === Role.OWNER && (
              <>
                <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-6 mb-2">Admin</p>
                <NavItem to="/upload" icon={Upload} label="Manage Data" themeColor="gray" />
                <NavItem to="/users" icon={Users} label="User Management" themeColor="gray" />
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 lg:hidden p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <PackageSearch className="text-blue-900" /> Sparezy
          </h1>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600 bg-gray-50 rounded-lg">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;