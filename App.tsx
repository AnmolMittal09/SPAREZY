
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, Role } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import PartsList from './pages/PartsList';
import Billing from './pages/Billing';
import Purchases from './pages/Purchases';
import Requisitions from './pages/Requisitions';
import Approvals from './pages/Approvals';
import StockMovements from './pages/StockMovements';
import LowStock from './pages/LowStock';
import OutOfStock from './pages/OutOfStock';
import ImportExport from './pages/ImportExport';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ItemDetail from './pages/ItemDetail';
import Invoices from './pages/Invoices';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 Minutes

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert("Session expired due to inactivity.");
        handleLogout();
      }, INACTIVITY_LIMIT_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, handleLogout]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {/* MAIN */}
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/parts" element={<PartsList user={user} />} />
          
          {/* TRANSACTIONS */}
          <Route path="/billing" element={<Billing user={user} />} />
          <Route 
             path="/invoices" 
             element={user.role === Role.OWNER ? <Invoices user={user} /> : <Navigate to="/" replace />} 
          />
          <Route path="/purchases" element={<Purchases user={user} />} />
          <Route path="/requisitions" element={<Requisitions user={user} />} />
          <Route 
            path="/approvals" 
            element={user.role === Role.OWNER ? <Approvals user={user} /> : <Navigate to="/" replace />} 
          />
          
          {/* INVENTORY */}
          <Route path="/movements" element={<StockMovements user={user} />} />
          <Route path="/low-stock" element={<LowStock user={user} />} />
          <Route path="/out-of-stock" element={<OutOfStock user={user} />} />
          <Route 
            path="/import-export" 
            element={user.role === Role.OWNER ? <ImportExport /> : <Navigate to="/" replace />} 
          />
          
          {/* REPORTS */}
          <Route 
            path="/reports" 
            element={user.role === Role.OWNER ? <Reports user={user} /> : <Navigate to="/" replace />} 
          />
          
          {/* ADMIN */}
          <Route 
            path="/settings" 
            element={user.role === Role.OWNER ? <Settings user={user} /> : <Navigate to="/" replace />} 
          />

          {/* Legacy / Detail Routes */}
          <Route path="/item/:partNumber" element={<ItemDetail />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
