import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authenticate } from '../services/userService';
import { ShieldCheck, User as UserIcon, Lock, Loader2, ArrowRight, Fingerprint, Activity } from 'lucide-react';
import Logo from '../components/Logo';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Security Entrance Animation
  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authenticate(username, password);
      
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Access Denied: Invalid Credentials');
      }
    } catch (err) {
      setError('System connection error: Authentication server unreachable');
    } finally {
      setLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6">
         <div className="relative mb-12">
            <div className="absolute inset-0 bg-blue-500/20 blur-[60px] animate-pulse"></div>
            <Logo variant="white" className="h-20 w-auto relative z-10" />
         </div>
         <div className="w-64 h-1 bg-slate-900 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-blue-600 w-1/3 animate-[loading_1.5s_ease-in-out_infinite]" style={{
                animationName: 'scan'
            }}></div>
         </div>
         <style>{`
            @keyframes scan {
                0% { left: -100%; width: 50%; }
                100% { left: 100%; width: 50%; }
            }
         `}</style>
         <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">System Integrity Scan</p>
            <div className="flex gap-1.5">
               <div className="w-1 h-1 rounded-full bg-blue-600 animate-bounce"></div>
               <div className="w-1 h-1 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
               <div className="w-1 h-1 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden font-['Plus_Jakarta_Sans']">
      
      {/* --- ENTERPRISE SECURITY BACKGROUND --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617]"></div>
         
         {/* Mesh Gradients */}
         <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] left-[-5%] w-[60%] h-[60%] bg-emerald-600/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
         
         {/* Cyber Grid */}
         <div className="absolute inset-0 opacity-[0.03]" style={{ 
             backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
             backgroundSize: '60px 60px' 
         }}></div>
      </div>

      {/* --- SECURE VAULT CONTAINER --- */}
      <div className="relative z-10 w-full max-w-md p-6 md:p-4">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[3rem] overflow-hidden animate-fade-in">
           
           {/* Terminal Header */}
           <div className="px-10 py-10 text-center border-b border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-blue-500">
                 <Activity size={24} />
              </div>
              <div className="flex justify-center mb-8">
                 <div className="relative">
                    <div className="absolute inset-0 bg-blue-600/20 blur-2xl group-hover:bg-blue-600/40 transition-all duration-700"></div>
                    <Logo variant="white" className="h-16 w-auto relative z-10" />
                 </div>
              </div>
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                 <span className="text-blue-400 text-[9px] font-black uppercase tracking-[0.2em]">Enterprise Secure Access</span>
              </div>
           </div>

           {/* Security Credentials */}
           <div className="p-10 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-[0.15em] p-4 rounded-2xl flex items-start gap-3.5 animate-slide-up">
                        <ShieldCheck className="mt-0.5 flex-none" size={16} /> 
                        <span className="leading-relaxed">{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] ml-2">Access Identifier</label>
                      <div className="relative group">
                          <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors" size={20} />
                          <input 
                              type="text" 
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-slate-950/50 border border-white/5 rounded-[1.25rem] px-14 py-4.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/40 focus:ring-8 focus:ring-blue-500/5 transition-all text-base font-bold shadow-inner"
                              placeholder="System ID"
                              required
                              autoComplete="off"
                          />
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] ml-2">Security Passphrase</label>
                      <div className="relative group">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors" size={20} />
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-950/50 border border-white/5 rounded-[1.25rem] px-14 py-4.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/40 focus:ring-8 focus:ring-blue-500/5 transition-all text-base font-bold shadow-inner"
                              placeholder="••••••••••••"
                              required
                          />
                      </div>
                  </div>

                  <div className="pt-4">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-blue-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm uppercase tracking-[0.2em]"
                      >
                         {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>Authorize Session <Fingerprint size={20} className="opacity-60" /></>
                         )}
                      </button>
                  </div>
              </form>
           </div>
           
           {/* Terminal Footer */}
           <div className="bg-white/[0.02] p-6 text-center border-t border-white/5">
              <p className="text-[8px] text-slate-600 uppercase tracking-[0.4em] font-black flex items-center justify-center gap-3">
                 <Activity size={10} className="text-emerald-500" />
                 Encrypted Link v4.2.0 • Secured by Sparezy Core
              </p>
           </div>
        </div>
      </div>

    </div>
  );
};

export default Login;