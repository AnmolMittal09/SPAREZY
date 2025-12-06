
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, Role } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BrandDashboard from './pages/BrandDashboard';
import UploadPage from './pages/Upload';
import DailyTransactions from './pages/DailyTransactions';
import ItemDetail from './pages/ItemDetail';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('sparezy_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('sparezy_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sparezy_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/transactions" element={<DailyTransactions user={user} />} />
          <Route path="/brand/:brandName" element={<BrandDashboard />} />
          <Route path="/item/:partNumber" element={<ItemDetail />} />
          {/* Protect Upload Route: Only Owner can access */}
          <Route 
            path="/upload" 
            element={user.role === Role.OWNER ? <UploadPage /> : <Navigate to="/" replace />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;