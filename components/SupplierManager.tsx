import React, { useEffect, useState } from 'react';
import { Supplier } from '../types';
import { getSuppliers, saveSupplier, deleteSupplier } from '../services/masterService';
import { Plus, Edit2, Trash2, Search, X, Save, Loader2, Truck } from 'lucide-react';

const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialForm: Supplier = {
    id: '',
    name: '',
    contactPerson: '',
    phone: '',
    gst: '',
    terms: ''
  };
  const [formData, setFormData] = useState<Supplier>(initialForm);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getSuppliers();
    setSuppliers(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveSupplier(formData);
    setSaving(false);
    if (res.success) {
      setIsEditing(false);
      setFormData(initialForm);
      loadData();
    } else {
      alert("Error: " + res.message);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData(supplier);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Delete this supplier?")) return;
    await deleteSupplier(id);
    loadData();
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Truck size={18} /> Suppliers
           </h3>
           <div className="flex gap-2">
              <div className="relative">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <input 
                   type="text" 
                   placeholder="Search..." 
                   className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-40 md:w-64"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
              <button 
                onClick={() => { setFormData(initialForm); setIsEditing(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
              >
                 <Plus size={16} /> Add
              </button>
           </div>
        </div>

        {/* Form Mode */}
        {isEditing && (
           <div className="p-6 bg-blue-50/50 border-b border-blue-100">
               <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-slate-800">{formData.id ? 'Edit Supplier' : 'New Supplier'}</h4>
                      <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                         <X size={20} />
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name *</label>
                          <input 
                            required 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                          <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.contactPerson}
                            onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                          <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN</label>
                          <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.gst || ''}
                            onChange={e => setFormData({...formData, gst: e.target.value})}
                          />
                       </div>
                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Terms / Notes</label>
                          <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.terms || ''}
                            onChange={e => setFormData({...formData, terms: e.target.value})}
                            placeholder="e.g. Net 30, Cash on Delivery..."
                          />
                       </div>
                   </div>

                   <div className="flex justify-end gap-2">
                       <button 
                         type="button" 
                         onClick={() => setIsEditing(false)} 
                         className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                       >
                         Cancel
                       </button>
                       <button 
                         type="submit" 
                         disabled={saving}
                         className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                       >
                         {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                         Save
                       </button>
                   </div>
               </form>
           </div>
        )}

        {/* Table List */}
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                   <tr>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Contact Person</th>
                      <th className="px-6 py-4">Phone</th>
                      <th className="px-6 py-4">GST / Terms</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {loading ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400"><Loader2 className="animate-spin mx-auto"/></td></tr>
                   ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">No suppliers found.</td></tr>
                   ) : (
                      filtered.map(s => (
                         <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                            <td className="px-6 py-4 text-slate-600">{s.contactPerson}</td>
                            <td className="px-6 py-4 text-slate-600">{s.phone}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                               {s.gst && <span className="font-bold mr-2">GST: {s.gst}</span>}
                               {s.terms}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex justify-end gap-1">
                                  <button onClick={() => handleEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                               </div>
                            </td>
                         </tr>
                      ))
                   )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default SupplierManager;