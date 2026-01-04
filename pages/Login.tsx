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
        if (rememberMe) {
          localStorage.setItem('sparezy_saved_username', username);
        } else {
          localStorage.removeItem('sparezy_saved_username');
        }
        onLogin(result.user);
      } else {
        setError(result.message || 'Access Denied');
      }
    } catch (err) {
      setError('System connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center relative overflow-hidden">
      
      {/* --- PREMIUM ABSTRACT BACKGROUND --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]"></div>
         
         {/* Refined Mesh Gradients */}
         <div className="absolute top-[-30%] left-[-20%] w-[100%] h-[100%] bg-blue-600/10 rounded-full blur-[160px] animate-pulse"></div>
         <div className="absolute bottom-[-30%] right-[-20%] w-[100%] h-[100%] bg-brand-600/10 rounded-full blur-[160px] animate-pulse delay-1000"></div>
         
         {/* Refined Grid Overlay */}
         <div className="absolute inset-0 opacity-[0.03]" style={{ 
             backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
         }}></div>
      </div>

      {/* --- LOGIN CONTAINER --- */}
      <div className="relative z-10 w-full max-w-md p-6">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] rounded-[3rem] overflow-hidden">
           
           {/* Branding Header */}
           <div className="p-10 pb-8 text-center border-b border-white/[0.05]">
              <div className="flex justify-center mb-8 scale-[1.15]">
                 <Logo variant="white" />
              </div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] opacity-80">Security Protocol</p>
           </div>

           {/* Auth Form */}
           <div className="p-10 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-black uppercase tracking-widest p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <Lock size={16} /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Access Key</label>
                      <div className="relative group">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-400 transition-colors" size={20} />
                          <input 
                              type="text" 
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-slate-950/40 border border-white/10 rounded-[1.25rem] px-12 py-4.5 text-white placeholder-slate-700 focus:outline-none focus:border-brand-500/40 focus:ring-4 focus:ring-brand-500/5 transition-all shadow-inner text-lg font-bold"
                              placeholder="Access ID"
                              required
                          />
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Passphrase</label>
                      <div className="relative group">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-400 transition-colors" size={20} />
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-950/40 border border-white/10 rounded-[1.25rem] px-12 py-4.5 text-white placeholder-slate-700 focus:outline-none focus:border-brand-500/40 focus:ring-4 focus:ring-brand-500/5 transition-all shadow-inner text-lg font-bold"
                              placeholder="••••••••"
                              required
                          />
                      </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-3 pt-2 ml-1">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          id="rememberMe"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-5 h-5 rounded-lg border-white/10 bg-slate-950/50 text-brand-600 focus:ring-brand-500 focus:ring-offset-[#0F172A] cursor-pointer"
                        />
                      </div>
                      <label htmlFor="rememberMe" className="text-xs font-bold text-slate-500 select-none cursor-pointer hover:text-slate-300 transition-colors uppercase tracking-widest">
                        Save Access Key
                      </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-brand-900/40 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4 text-[15px] uppercase tracking-[0.15em]"
                  >
                     {loading ? <Loader2 className="animate-spin" size={22} /> : (
                        <>Establish Session <ArrowRight size={20} className="opacity-70" /></>
                     )}
                  </button>
              </form>
           </div>
           
           {/* Footer Branding */}
           <div className="bg-white/[0.02] p-6 text-center border-t border-white/[0.05]">
              <p className="text-[9px] text-slate-600 uppercase tracking-[0.4em] font-extrabold">
                 Core System Enterprise v4.2
              </p>
           </div>
        </div>
      </div>

    </div>
  );
};

export default Login;