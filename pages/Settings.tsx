
import React, { useState } from 'react';
import { User } from '../types';
import UserManagement from './UserManagement';
import { Users, Building2, Truck, Contact, Layers } from 'lucide-react';

interface Props {
  user: User;
}

const Settings: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('TEAM');

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>
             <p className="text-slate-500">Manage application configuration and master data.</p>
          </div>
       </div>

       <div className="flex overflow-x-auto border-b border-slate-200">
          {[
            { id: 'TEAM', label: 'Team Access', icon: Users },
            { id: 'SHOP', label: 'Shop Settings', icon: Building2 },
            { id: 'BRANDS', label: 'Brands & Models', icon: Layers },
            { id: 'CUSTOMERS', label: 'Customers', icon: Contact },
            { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck },
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-slate-900 text-slate-900 font-bold' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
             >
                <tab.icon size={18} /> {tab.label}
             </button>
          ))}
       </div>

       <div className="min-h-[500px]">
          {activeTab === 'TEAM' && <UserManagement />}
          {activeTab !== 'TEAM' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <p className="text-lg font-medium text-slate-600 mb-2">Master Data Module</p>
                <p>The {activeTab.toLowerCase().replace('_', ' ')} management interface is implemented in the mock service layer.</p>
                <p className="text-sm mt-2">Connecting UI forms to `masterService.ts` is the next step.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Settings;
