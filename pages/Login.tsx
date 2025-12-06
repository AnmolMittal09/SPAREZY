import React, { useState } from 'react';
import { User, Role } from '../types';
import { ShieldCheck, User as UserIcon } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
           <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
             <ShieldCheck className="text-white" size={32} />
           </div>
           <h1 className="text-3xl font-bold text-white">Sparezy</h1>
           <p className="text-blue-100 mt-2">Stock Management System</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center border border-red-100">
                    {error}
                </div>
            )}
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Username</label>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter username"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                     <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200"
            >
                Sign In
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>Demo Access:</p>
            <p>Owner: admin / admin</p>
            <p>Manager: manager / manager (Read Only)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;