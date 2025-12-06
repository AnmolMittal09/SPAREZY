import React from 'react';
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
  ShoppingCart
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

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive(to) 
          ? 'bg-blue-600 text-white' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
      onClick={() => setIsSidebarOpen(false)}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              <PackageSearch className="text-blue-600" />
              Sparezy
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Logged in as <span className="font-semibold text-blue-600">{user.role}</span>
            </p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/transactions" icon={ShoppingCart} label="Daily Sales / Purchase" />
            <NavItem to="/brand/hyundai" icon={Car} label="Hyundai Stock" />
            <NavItem to="/brand/mahindra" icon={Car} label="Mahindra Stock" />
            
            {user.role === Role.OWNER && (
              <NavItem to="/upload" icon={Upload} label="Update Stock / Prices" />
            )}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 lg:hidden p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Sparezy</h1>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
