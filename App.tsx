import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, Role } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BrandDashboard from './pages/BrandDashboard';
import UploadPage from './pages/Upload';
import DailyTransactions from './pages/DailyTransactions';
import ItemDetail from './pages/ItemDetail';
import UserManagement from './pages/UserManagement';
import StockRequests from './pages/StockRequests';
import Reports from './pages/Reports';
import Layout from './components/Layout';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 Minutes

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  // --- STRICT SECURITY: NO SESSION PERSISTENCE ---
  // We intentionally DO NOT load user from localStorage on mount.
  // This ensures a page refresh clears the session.

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  // --- INACTIVITY TIMER ---
  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert("Session expired due to inactivity (30 mins). Please log in again.");
        handleLogout();
      }, INACTIVITY_LIMIT_MS);
    };

    // Events to track activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Attach listeners
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Initialize timer
    resetTimer();

    // Cleanup
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
          <Route path="/parts" element={<Dashboard user={user} />} /> {/* Mapping Parts List to Dashboard for now */}

          {/* TRANSACTIONS */}
          <Route path="/billing" element={<DailyTransactions user={user} />} />
          <Route path="/purchases" element={<DailyTransactions user={user} />} />
          <Route path="/transactions" element={<DailyTransactions user={user} />} />
          <Route path="/requests" element={<StockRequests user={user} />} />

          {/* INVENTORY & BRAND */}
          <Route path="/brand/:brandName" element={<BrandDashboardWrapper user={user} />} />
          <Route path="/item/:partNumber" element={<ItemDetail />} />
          <Route path="/low-stock" element={<Dashboard user={user} />} /> {/* Mapped to Dashboard */}
          <Route path="/stock-movements" element={<Reports user={user} />} /> {/* Mapped to Reports */}
          
          {/* REPORTS */}
          <Route 
            path="/reports" 
            element={user.role === Role.OWNER ? <Reports user={user} /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/reports/*" 
            element={user.role === Role.OWNER ? <Reports user={user} /> : <Navigate to="/" replace />} 
          />

          {/* ADMIN */}
          <Route 
            path="/upload" 
            element={user.role === Role.OWNER ? <UploadPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/users" 
            element={user.role === Role.OWNER ? <UserManagement /> : <Navigate to="/" replace />} 
          />
           <Route 
            path="/settings/*" 
            element={user.role === Role.OWNER ? <UserManagement /> : <Navigate to="/" replace />} 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

// Helper wrapper to pass props to BrandDashboard
const BrandDashboardWrapper = ({ user }: { user: User }) => {
  return <BrandDashboard user={user} />;
};

export default App;