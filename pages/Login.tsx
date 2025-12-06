import React, { useState } from 'react';
import { User, Role } from '../types';
import { ShieldCheck, User as UserIcon, Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock Auth
    if (username === 'admin' && password === 'admin') {
      onLogin({ id: '1', username: 'admin', name: 'Mr. Owner', role: Role.OWNER });
    } else if (username === 'manager' && password === 'manager') {
      onLogin({ id: '2', username: 'manager', name: 'Rajesh Manager', role: Role.MANAGER });
    } else {
      setError('Invalid credentials. Try admin/admin or manager/manager');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900"></div>
         <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gray-100"></div>
         {/* Brand Accents */}
         <div className="absolute top-0 right-0 w-1/2 h-2 bg-red-600"></div>
         <div className="absolute top-0 left-0 w-1/2 h-2 bg-blue-900"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10 relative">
        <div className="bg-slate-900 p-8 text-center border-b-4 border-blue-900 relative overflow-hidden">
            {/* Glossy overlay */}
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
           
           <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner border border-white/10">
             <ShieldCheck className="text-white" size={32} />
           </div>
           <h1 className="text-3xl font-extrabold text-white tracking-tight">Sparezy</h1>
           <p className="text-blue-200 mt-1 font-medium text-sm">Stock Management System</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg text-center border border-red-100 flex items-center justify-center gap-2">
                    <Lock size={14} />
                    {error}
                </div>
            )}
            
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Username</label>
                <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-gray-800"
                        placeholder="Enter username"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Password</label>
                <div className="relative group">
                     <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-gray-800"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200 mt-2"
            >
                Sign In
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-blue-50 p-2 rounded text-center border border-blue-100">
                    <span className="block font-bold text-blue-800">Owner</span>
                    <span className="text-blue-600">admin / admin</span>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center border border-gray-200">
                    <span className="block font-bold text-gray-700">Manager</span>
                    <span className="text-gray-500">manager / manager</span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;