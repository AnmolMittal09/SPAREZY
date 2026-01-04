import React, { useState, useEffect } from 'react';
import { ShopSettings, User } from '../types';
import UserManagement from './UserManagement';
import CustomerManager from '../components/CustomerManager';
import SupplierManager from '../components/SupplierManager';
import { getShopSettings, saveShopSettings } from '../services/masterService';
import { triggerAutoRefresh } from '../services/refreshService';
import { Users, Building2, Truck, Contact, Layers, Save, Loader2 } from 'lucide-react';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Settings: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('TEAM');

  // Shop Settings State
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    name: '',
    address: '',
    phone: '',
    gst: '',
    defaultTaxRate: 18
  });
  const [loadingShop, setLoadingShop] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  useEffect(() => {
    if (activeTab === 'SHOP') {
      loadShopSettings();
    }
  }, [activeTab]);

  const loadShopSettings = async () => {
    setLoadingShop(true);
    const data = await getShopSettings();
    setShopSettings(data);
    setLoadingShop(false);
  };

  const handleShopSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    await saveShopSettings(shopSettings);
    triggerAutoRefresh(800);
  };

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
          
          {activeTab === 'CUSTOMERS' && <CustomerManager />}

          {activeTab === 'SUPPLIERS' && <SupplierManager />}
          
          {activeTab === 'SHOP' && (
             <div className="max-w-3xl mx-auto">
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                     <h3 className="font-bold text-lg text-slate-800">Business Details</h3>
                     <p className="text-sm text-slate-500">These details will appear on your printed invoices.</p>
                  </div>
                  
                  {loadingShop ? (
                    <div className="p-12"><TharLoader /></div>
                  ) : (
                    <form onSubmit={handleShopSave} className="p-6 space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-2">
                             <label className="block text-sm font-bold text-slate-700 mb-1">Shop / Business Name</label>
                             <input 
                               type="text"
                               required
                               className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                               value={shopSettings.name}
                               onChange={e => setShopSettings({...shopSettings, name: e.target.value})}
                             />
                          </div>
                          
                          <div className="col-span-2">
                             <label className="block text-sm font-bold text-slate-700 mb-1">Full Address</label>
                             <textarea 
                               required
                               rows={3}
                               className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                               value={shopSettings.address}
                               onChange={e => setShopSettings({...shopSettings, address: e.target.value})}
                             />
                          </div>

                          <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
                             <input 
                               type="text"
                               required
                               className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                               value={shopSettings.phone}
                               onChange={e => setShopSettings({...shopSettings, phone: e.target.value})}
                             />
                          </div>

                          <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">GST Number</label>
                             <input 
                               type="text"
                               className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                               value={shopSettings.gst}
                               onChange={e => setShopSettings({...shopSettings, gst: e.target.value})}
                             />
                          </div>

                          <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Default Tax Rate (%)</label>
                             <input 
                               type="number"
                               className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                               value={shopSettings.defaultTaxRate}
                               onChange={e => setShopSettings({...shopSettings, defaultTaxRate: parseFloat(e.target.value)})}
                             />
                          </div>
                       </div>

                       <div className="pt-4 border-t border-slate-100 flex justify-end">
                          <button 
                            type="submit" 
                            disabled={savingShop}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                             {savingShop ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                             {savingShop ? 'Syncing...' : 'Save & Sync'}
                          </button>
                       </div>
                    </form>
                  )}
               </div>
             </div>
          )}

          {activeTab === 'BRANDS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <p className="text-lg font-medium text-slate-600 mb-2">Brands & Models</p>
                <p>Advanced vehicle model mapping is coming soon.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Settings;
