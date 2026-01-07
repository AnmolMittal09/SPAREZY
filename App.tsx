
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, Role } from './types';
import Login from './pages/Login';
import Layout from './components/Layout';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

// Optimized Lazy Loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PartsList = lazy(() => import('./pages/PartsList'));
const Billing = lazy(() => import('./pages/Billing'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Requisitions = lazy(() => import('./pages/Requisitions'));
const Approvals = lazy(() => import('./pages/Approvals'));
const StockMovements = lazy(() => import('./pages/StockMovements'));
const LowStock = lazy(() => import('./pages/LowStock'));
const OutOfStock = lazy(() => import('./pages/OutOfStock'));
const ImportExport = lazy(() => import('./pages/ImportExport'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const ProfitAnalysis = lazy(() => import('./pages/ProfitAnalysis'));
const Tasks = lazy(() => import('./pages/Tasks'));

// Updated to 30 Minutes as requested
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; 
const WARNING_THRESHOLD_MS = 60 * 1000; // 1 Minute warning before final logout

// Simple skeleton for lazy loading fallback
const RouteLoader = () => (
  <div className="flex h-full w-full items-center justify-center py-20">
    <Loader2 className="animate-spin text-brand-600" size={40} />
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    resetTimers();
  };

  const handleLogout = useCallback(() => {
    setUser(null);
    setShowWarning(false);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!user) return;

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    setShowWarning(false);

    // Set warning for 29 minutes
    warningTimerRef.current = setTimeout(() => {
      if (user.id !== 'dev-mode') setShowWarning(true);
    }, INACTIVITY_LIMIT_MS - WARNING_THRESHOLD_MS);

    // Set logout for 30 minutes
    logoutTimerRef.current = setTimeout(() => {
      if (user.id !== 'dev-mode') handleLogout();
    }, INACTIVITY_LIMIT_MS);
  }, [user, handleLogout]);

  useEffect(() => {
    if (!user) return;

    // Detect user activity to keep session alive
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const resetHandler = () => resetTimers();
    
    events.forEach(event => window.addEventListener(event, resetHandler));
    
    const handleVisibilityChange = () => {
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
      
      const newState = document.visibilityState === 'visible';
      
      if (!newState) {
        // Delay privacy shield slightly to prevent flashing on fast swaps
        visibilityTimeoutRef.current = setTimeout(() => {
          setIsTabFocused(false);
        }, 500);
      } else {
        setIsTabFocused(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimers();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetHandler));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
    };
  }, [user, resetTimers]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {!isTabFocused && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-[40px] flex flex-col items-center justify-center animate-fade-in">
           <div className="bg-white/10 p-8 rounded-[3rem] border border-white/20 shadow-2xl flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border border-white/20 animate-pulse">
                 <ShieldCheck size={48} className="text-white" />
              </div>
              <div className="text-center">
                 <h2 className="text-2xl font-black text-white uppercase tracking-widest">Privacy Shield Active</h2>
                 <p className="text-white/60 text-xs font-bold uppercase mt-2 tracking-widest">Return to tab to resume session</p>
              </div>
           </div>
        </div>
      )}

      {showWarning && (
        <div className="fixed bottom-6 right-6 z-[1000] bg-slate-900 text-white p-6 rounded-[2rem] shadow-elevated border border-white/10 animate-slide-up max-w-sm ring-1 ring-amber-500/50">
           <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl animate-pulse">
                 <ShieldAlert size={24} />
              </div>
              <div>
                 <h4 className="font-black text-sm uppercase tracking-widest">Session Expiring</h4>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 leading-relaxed">
                   You will be automatically logged out in less than 60 seconds due to 30 minutes of inactivity.
                 </p>
                 <div className="flex gap-3 mt-4">
                    <button 
                      onClick={resetTimers}
                      className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Stay Logged In
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="text-white/40 hover:text-rose-400 px-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Logout Now
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <HashRouter>
        <Layout user={user} onLogout={handleLogout}>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/parts" element={<PartsList user={user} />} />
              <Route path="/tasks" element={<Tasks user={user} />} />
              <Route path="/billing" element={<Billing user={user} />} />
              <Route path="/purchases" element={<Purchases user={user} />} />
              <Route path="/requisitions" element={<Requisitions user={user} />} />
              <Route 
                path="/approvals" 
                element={user.role === Role.OWNER ? <Approvals user={user} /> : <Navigate to="/" replace />} 
              />
              <Route path="/movements" element={<StockMovements user={user} />} />
              <Route path="/low-stock" element={<LowStock user={user} />} />
              <Route path="/out-of-stock" element={<OutOfStock user={user} />} />
              <Route 
                path="/import-export" 
                element={user.role === Role.OWNER ? <ImportExport /> : <Navigate to="/" replace />} 
              />
              <Route 
                path="/reports" 
                element={user.role === Role.OWNER ? <Reports user={user} /> : <Navigate to="/" replace />} 
              />
              <Route 
                path="/profit-analysis" 
                element={user.role === Role.OWNER ? <ProfitAnalysis user={user} /> : <Navigate to="/" replace />} 
              />
              <Route 
                path="/settings" 
                element={user.role === Role.OWNER ? <Settings user={user} /> : <Navigate to="/" replace />} 
              />
              <Route path="/item/:partNumber" element={<ItemDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </div>
  );
};

export default App;
