import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authenticate } from '../services/userService';
import { ShieldCheck, User as UserIcon, Lock, Loader2, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load saved username on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('sparezy_saved_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authenticate(username, password);
      
      if (result.success && result.user) {
        // Handle Remember Me (Only saves username, not the session)
        if (rememberMe) {
          localStorage.setItem('sparezy_saved_username', username);
        } else {
          localStorage.removeItem('sparezy_saved_username');
        }

        onLogin(result.user);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* --- SAAS ABSTRACT BACKGROUND --- */}
      <div className="absolute inset-0 z-0 overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
         
         {/* Mesh Gradients */}
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-teal-600/20 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
         
         {/* Grid Pattern Overlay */}
         <div className="absolute inset-0" style={{ 
             backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
         }}></div>
      </div>

      {/* --- LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
           
           {/* Header */}
           <div className="p-8 pb-6 text-center border-b border-white/5">
              <div className="flex justify-center mb-6 scale-110">
                 <Logo variant="white" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Welcome back. Please sign in.</p>
           </div>

           {/* Form */}
           <div className="p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-bold p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <Lock size={14} /> {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                      <div className="relative group">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
                          <input 
                              type="text" 
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-10 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all shadow-inner"
                              placeholder="Enter Access ID"
                              required
                          />
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                      <div className="relative group">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-10 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all shadow-inner"
                              placeholder="••••••••"
                              required
                          />
                      </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center gap-2 pt-1">
                      <input 
                        type="checkbox" 
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900/50 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="rememberMe" className="text-sm text-slate-400 select-none cursor-pointer hover:text-white transition-colors">
                        Remember my ID
                      </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-900/20 transition-all transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                     {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>Sign In <ArrowRight size={18} opacity={0.8} /></>
                     )}
                  </button>
              </form>
           </div>
           
           {/* Footer */}
           <div className="bg-slate-950/30 p-4 text-center border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                 Powered by Sparezy v3.0
              </p>
           </div>
        </div>
      </div>

    </div>
  );
};

export default Login;