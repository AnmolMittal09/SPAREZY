
import React, { useState, useEffect } from 'react';
import { Customer, Transaction, TransactionType } from '../types';
import { getCustomers, saveCustomer, deleteCustomer } from '../services/masterService';
import { fetchCustomerTransactions } from '../services/transactionService';
import { Contact, Plus, Search, Trash2, Edit2, Save, X, History, ShoppingBag, ArrowRight } from 'lucide-react';
import TharLoader from '../components/TharLoader';

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const loadHistory = async (customerName: string) => {
    setLoadingHistory(true);
    const data = await fetchCustomerTransactions(customerName);
    setCustomerHistory(data);
    setLoadingHistory(false);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setActiveCustomer(customer);
    setIsEditing(false);
    loadHistory(customer.name);
  };

  const handleCreateNew = () => {
    setFormData({ type: 'RETAIL' });
    setIsEditing(true);
    setActiveCustomer(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData(customer);
    setIsEditing(true);
    setActiveCustomer(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    await deleteCustomer(id);
    loadCustomers();
    if (activeCustomer?.id === id) setActiveCustomer(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const res = await saveCustomer(formData as Customer);
    if (res.success) {
      loadCustomers();
      setIsEditing(false);
      if (formData.id) {
          // If editing, re-select
          const updated = { ...formData } as Customer;
          handleSelectCustomer(updated);
      }
    } else {
      alert("Failed to save: " + res.message);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
       {/* Left Column: Customer List */}
       <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Contact size={18} /> Customers
                </h3>
                <button 
                  onClick={handleCreateNew}
                  className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                >
                   <Plus size={18} />
                </button>
             </div>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search name or phone..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto">
             {loading ? <div className="p-8 flex justify-center"><TharLoader /></div> : (
                filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No customers found.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredCustomers.map(c => (
                            <div 
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center group ${activeCustomer?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                            >
                               <div>
                                  <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                                  <div className="text-xs text-slate-500">{c.phone}</div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${c.type === 'GARAGE' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                     {c.type}
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded hidden group-hover:block"
                                  >
                                     <Edit2 size={14} />
                                  </button>
                               </div>
                            </div>
                        ))}
                    </div>
                )
             )}
          </div>
       </div>

       {/* Right Column: Details or Form */}
       <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {isEditing ? (
             <div className="p-6 max-w-lg mx-auto w-full">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                   {formData.id ? <Edit2 size={20}/> : <Plus size={20}/>}
                   {formData.id ? 'Edit Customer' : 'New Customer'}
                </h3>
                
                <form onSubmit={handleSave} className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Customer Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.name || ''}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                        <input 
                            type="text" 
                            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.phone || ''}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                        <select 
                            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={formData.type}
                            onChange={e => setFormData({...formData, type: e.target.value as any})}
                        >
                            <option value="RETAIL">Retail</option>
                            <option value="GARAGE">Garage / Mechanic</option>
                        </select>
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">GSTIN (Optional)</label>
                      <input 
                        type="text" 
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.gst || ''}
                        onChange={e => setFormData({...formData, gst: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
                      <textarea 
                        rows={3}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={formData.address || ''}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                   </div>

                   <div className="flex gap-3 pt-4">
                      <button 
                        type="submit" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                         <Save size={18} /> Save Customer
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                         <X size={18} /> Cancel
                      </button>
                   </div>
                </form>
             </div>
          ) : activeCustomer ? (
             <div className="flex flex-col h-full">
                {/* Customer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
                   <div>
                      <h2 className="text-xl font-bold text-slate-900">{activeCustomer.name}</h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                         <span>{activeCustomer.phone || 'No Phone'}</span>
                         <span>•</span>
                         <span>{activeCustomer.address || 'No Address Provided'}</span>
                      </div>
                      {activeCustomer.gst && (
                         <div className="mt-1 text-xs font-mono bg-slate-200 px-2 py-0.5 rounded w-fit text-slate-600">
                            GST: {activeCustomer.gst}
                         </div>
                      )}
                   </div>
                   <button 
                     onClick={() => handleDelete(activeCustomer.id)}
                     className="text-slate-400 hover:text-red-600 p-2 transition-colors"
                     title="Delete Customer"
                   >
                      <Trash2 size={18} />
                   </button>
                </div>

                {/* Transaction History */}
                <div className="flex-1 flex flex-col min-h-0">
                   <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-2 text-sm font-bold text-slate-700">
                      <History size={16} /> Purchase History
                   </div>
                   
                   <div className="flex-1 overflow-auto bg-white">
                      {loadingHistory ? (
                         <div className="p-12 flex justify-center"><TharLoader /></div>
                      ) : customerHistory.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <ShoppingBag size={48} className="mb-2 opacity-20" />
                            <p>No transactions found for this customer.</p>
                         </div>
                      ) : (
                         <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                               <tr>
                                  <th className="px-6 py-3">Date</th>
                                  <th className="px-6 py-3">Part Details</th>
                                  <th className="px-6 py-3 text-center">Qty</th>
                                  <th className="px-6 py-3 text-right">Amount</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {customerHistory.map(tx => (
                                  <tr key={tx.id} className="hover:bg-slate-50">
                                     <td className="px-6 py-3 text-slate-500">
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                     </td>
                                     <td className="px-6 py-3">
                                        <div className="font-bold text-slate-800">{tx.partNumber}</div>
                                        <div className="text-xs text-slate-500 capitalize">{tx.type.toLowerCase()}</div>
                                     </td>
                                     <td className="px-6 py-3 text-center">
                                        {tx.type === TransactionType.RETURN ? (
                                            <span className="text-red-600 font-bold">-{tx.quantity}</span>
                                        ) : (
                                            tx.quantity
                                        )}
                                     </td>
                                     <td className="px-6 py-3 text-right font-medium">
                                        ₹{(tx.price * tx.quantity).toLocaleString()}
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      )}
                   </div>
                </div>
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <ArrowRight size={48} className="mb-4 opacity-20" />
                <p>Select a customer to view details and history.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default CustomerManagement;
