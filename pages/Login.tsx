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
         <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#0F172A]"></div>
         
         {/* Refined Mesh Gradients */}
         <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-blue-600/5 rounded-full blur-[140px] animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-brand-600/5 rounded-full blur-[140px] animate-pulse delay-1000"></div>
         
         {/* Refined Grid Overlay */}
         <div className="absolute inset-0 opacity-[0.02]" style={{ 
             backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
         }}></div>
      </div>

      {/* --- LOGIN CONTAINER --- */}
      <div className="relative z-10 w-full max-w-sm p-5">
        <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 shadow-elevated rounded-[2.5rem] overflow-hidden">
           
           {/* Branding Header */}
           <div className="p-8 pb-6 text-center border-b border-white/[0.05]">
              <div className="flex justify-center mb-6">
                 <Logo variant="white" className="h-14 w-auto" />
              </div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">Security Protocol</p>
           </div>

           {/* Auth Form */}
           <div className="p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider p-3.5 rounded-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
                        <Lock size={14} /> {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1.5">Access Key</label>
                      <div className="relative group">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-400 transition-colors" size={18} />
                          <input 
                              type="text" 
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-slate-950/30 border border-white/5 rounded-xl px-11 py-3.5 text-white placeholder-slate-700 focus:outline-none focus:border-brand-500/30 focus:ring-4 focus:ring-brand-500/5 transition-all text-base font-semibold"
                              placeholder="Access ID"
                              required
                          />
                      </div>
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1.5">Passphrase</label>
                      <div className="relative group">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-400 transition-colors" size={18} />
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-950/30 border border-white/5 rounded-xl px-11 py-3.5 text-white placeholder-slate-700 focus:outline-none focus:border-brand-500/30 focus:ring-4 focus:ring-brand-500/5 transition-all text-base font-semibold"
                              placeholder="••••••••"
                              required
                          />
                      </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-2.5 pt-1 ml-1">
                      <input 
                        type="checkbox" 
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-slate-950/50 text-brand-600 focus:ring-brand-500/20 focus:ring-offset-[#0F172A] cursor-pointer"
                      />
                      <label htmlFor="rememberMe" className="text-[11px] font-semibold text-slate-500 select-none cursor-pointer hover:text-slate-300 transition-colors uppercase tracking-wider">
                        Remember Session
                      </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 text-sm uppercase tracking-widest"
                  >
                     {loading ? <Loader2 className="animate-spin" size={18} /> : (
                        <>Sign In <ArrowRight size={18} className="opacity-60" /></>
                     )}
                  </button>
              </form>
           </div>
           
           {/* Footer Branding */}
           <div className="bg-white/[0.01] p-5 text-center border-t border-white/[0.05]">
              <p className="text-[8px] text-slate-700 uppercase tracking-[0.3em] font-bold">
                 Enterprise Terminal v4.2
              </p>
           </div>
        </div>
      </div>

    </div>
  );
};

export default Login;