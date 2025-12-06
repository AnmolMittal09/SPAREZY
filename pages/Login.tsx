
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authenticate } from '../services/userService';
import { ShieldCheck, User as UserIcon, Lock, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* --- 3D ENVIRONMENT BACKGROUND --- */}
      <div className="absolute inset-0 z-0 flex">
        {/* HYUNDAI ZONE (Left) */}
        <div className="w-1/2 h-full relative bg-slate-900 overflow-hidden">
           {/* Deep Blue Gradient */}
           <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-black opacity-90"></div>
           
           {/* "Headlight" Bloom */}
           <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
           
           {/* Perspective Grid Floor (Left) */}
           <div 
             className="absolute bottom-0 left-0 right-0 h-1/2 border-t border-blue-900/30"
             style={{ 
               background: 'linear-gradient(180deg, rgba(30, 58, 138, 0) 0%, rgba(30, 58, 138, 0.1) 100%)',
               transform: 'perspective(500px) rotateX(60deg) translateY(100px) translateZ(-100px)'
             }}
           >
              <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)', backgroundSize: '40px 100%' }}></div>
           </div>

           {/* Brand Text Background */}
           <h1 className="absolute bottom-10 left-10 text-9xl font-black text-blue-900 opacity-10 tracking-tighter select-none hidden md:block">HYUNDAI</h1>
        </div>

        {/* MAHINDRA ZONE (Right) */}
        <div className="w-1/2 h-full relative bg-slate-900 overflow-hidden">
           {/* Deep Red Gradient */}
           <div className="absolute inset-0 bg-gradient-to-bl from-red-950 via-slate-900 to-black opacity-90"></div>
           
           {/* "Headlight" Bloom */}
           <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-red-600 rounded-full blur-[100px] opacity-20 animate-pulse delay-75"></div>

           {/* Perspective Grid Floor (Right) */}
           <div 
             className="absolute bottom-0 left-0 right-0 h-1/2 border-t border-red-900/30"
             style={{ 
               background: 'linear-gradient(180deg, rgba(153, 27, 27, 0) 0%, rgba(153, 27, 27, 0.1) 100%)',
               transform: 'perspective(500px) rotateX(60deg) translateY(100px) translateZ(-100px)'
             }}
           >
              <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)', backgroundSize: '40px 100%' }}></div>
           </div>

           {/* Brand Text Background */}
           <h1 className="absolute top-10 right-10 text-9xl font-black text-red-900 opacity-10 tracking-tighter select-none text-right hidden md:block">MAHINDRA</h1>
        </div>
      </div>

      {/* --- FLOATING GLASS LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl overflow-hidden relative">
           
           {/* Glossy Reflection */}
           <div className="absolute -top-24 -left-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>

           {/* Header */}
           <div className="p-8 pb-4 text-center border-b border-white/5 relative">
              <div className="flex justify-center mb-6">
                 {/* New Logo Implementation */}
                 <Logo className="h-28 w-auto drop-shadow-lg" variant="white" />
              </div>
              <p className="text-gray-400 text-sm">Authorized Access Only</p>
           </div>

           {/* Form */}
           <div className="p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2">
                        <Lock size={14} /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Username</label>
                      <div className="relative group">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" size={18} />
                          <input 
                              type="text" 
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-black/20 border border-white/10 rounded-xl px-10 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all"
                              placeholder="Enter ID"
                              required
                          />
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
                      <div className="relative group">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" size={18} />
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-black/20 border border-white/10 rounded-xl px-10 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 focus:bg-black/40 transition-all"
                              placeholder="••••••••"
                              required
                          />
                      </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-black/40 text-blue-600 focus:ring-blue-500 focus:ring-offset-black/50"
                      />
                      <label htmlFor="rememberMe" className="text-sm text-gray-400 select-none cursor-pointer hover:text-white transition-colors">
                        Remember username
                      </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-700 to-red-700 hover:from-blue-600 hover:to-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                  >
                     {loading ? <Loader2 className="animate-spin" size={20} /> : 'Authenticate'}
                  </button>
              </form>
           </div>
           
           {/* Footer Decor */}
           <div className="bg-black/30 p-4 flex justify-between items-center text-[10px] text-gray-600 uppercase tracking-widest font-bold border-t border-white/5">
              <span>System v2.4</span>
              <span>Secure Connection</span>
           </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
