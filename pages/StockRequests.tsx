import React, { useEffect, useState } from 'react';
import { User, Role, StockItem, StockRequest, RequestStatus } from '../types';
import { fetchInventory } from '../services/inventoryService';
import { createStockRequests, fetchStockRequests, updateRequestStatus } from '../services/requestService';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ShoppingCart, 
  Trash2, 
  Loader2,
  PackagePlus,
  History
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const formatQty = (n: number) => {
  const abs = Math.abs(n);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return n < 0 ? `-${str}` : str;
};

interface Props {
  user: User;
}

const StockRequests: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  
  // Manager State
  const [cart, setCart] = useState<{ partNumber: string; name: string; currentStock: number; requestQty: number }[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin/Shared State
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loadingReq, setLoadingReq] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadData = async () => {
    setLoadingInv(true);
    const inv = await fetchInventory();
    setInventory(inv);
    setLoadingInv(false);
  };

  const loadRequests = async () => {
    setLoadingReq(true);
    const all = await fetchStockRequests();
    if (activeTab === 'PENDING') {
      setRequests(all.filter(r => r.status === RequestStatus.PENDING));
    } else {
      setRequests(all.filter(r => r.status !== RequestStatus.PENDING));
    }
    setLoadingReq(false);
  };

  // --- MANAGER FUNCTIONS ---

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term) {
      setSuggestions([]);
      return;
    }
    const matches = inventory.filter(i => 
      i.partNumber.toLowerCase().includes(term.toLowerCase()) || 
      i.name.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 5);
    setSuggestions(matches);
  };

  const addToRequest = (item: StockItem, qty: number = 5) => {
    if (cart.some(c => c.partNumber === item.partNumber)) return;
    setCart(prev => [...prev, {
      partNumber: item.partNumber,
      name: item.name,
      currentStock: item.quantity,
      requestQty: qty
    }]);
    setSearchTerm('');
    setSuggestions([]);
  };

  const removeFromCart = (partNumber: string) => {
    setCart(prev => prev.filter(c => c.partNumber !== partNumber));
  };

  const updateCartQty = (partNumber: string, qty: number) => {
    setCart(prev => prev.map(c => c.partNumber === partNumber ? { ...c, requestQty: qty } : c));
  };

  const submitRequest = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    
    const payload = cart.map(c => ({
      partNumber: c.partNumber,
      quantity: c.requestQty,
      requesterName: user.name
    }));

    const res = await createStockRequests(payload);
    
    if (res.success) {
      alert("Stock request sent to Admin successfully!");
      setCart([]);
      if (activeTab === 'PENDING') loadRequests();
    } else {
      alert("Failed to send request: " + res.message);
    }
    setSubmitting(false);
  };

  // --- ADMIN FUNCTIONS ---

  const handleStatusChange = async (ids: string[], status: RequestStatus) => {
    if (!window.confirm(`Mark ${ids.length} items as ${status}?`)) return;
    
    try {
      await updateRequestStatus(ids, status);
      loadRequests();
    } catch (err) {
      alert("Error updating status");
    }
  };

  if (loadingInv) return <TharLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
           <ClipboardList className="text-blue-600" /> Stock Requisition
        </h1>
        <p className="text-gray-500">
          {user.role === Role.MANAGER 
            ? "Request new stock from the Admin." 
            : "Review and process stock requests from Managers."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* LEFT COLUMN: MANAGER INPUT */}
         <div className="lg:col-span-1 space-y-6">
            
            {/* 1. Manual Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
               <h3 className="font-bold text-gray-800 mb-3 uppercase text-[10px] tracking-widest">Add Items to List</h3>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input 
                     type="text" 
                     className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                     placeholder="Search Part Number..."
                     value={searchTerm}
                     onChange={e => handleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                     <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {suggestions.map(s => (
                           <div 
                              key={s.id} 
                              onClick={() => addToRequest(s)}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm"
                           >
                              <div className="font-bold">{s.partNumber}</div>
                              <div className="text-xs text-gray-500">{s.name}</div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            {/* 2. Request Cart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col h-fit">
               <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase text-[10px] tracking-widest">
                  <ShoppingCart size={16} /> Current Draft ({formatQty(cart.length)})
               </h3>
               
               {cart.length === 0 ? (
                  <div className="text-center text-gray-400 py-12 border-2 border-dashed border-slate-50 rounded-xl text-xs">Search for parts to add them here.</div>
               ) : (
                  <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                     {cart.map(item => (
                        <div key={item.partNumber} className="flex items-center justify-between text-sm bg-gray-50 p-2.5 rounded-lg border border-slate-100">
                           <div className="flex-1 min-w-0 mr-2">
                              <div className="font-bold truncate text-slate-800">{item.partNumber}</div>
                              <div className="text-[10px] text-slate-400 truncate font-medium">{item.name}</div>
                           </div>
                           <div className="flex items-center gap-2">
                              <input 
                                 type="number" 
                                 min="1"
                                 className="w-14 px-2 py-1 border border-slate-200 rounded-md text-center text-xs font-bold bg-white"
                                 value={item.requestQty === 0 ? '' : item.requestQty}
                                 onChange={(e) => updateCartQty(item.partNumber, parseInt(e.target.value) || 0)}
                              />
                              <button onClick={() => removeFromCart(item.partNumber)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}

               <button 
                  onClick={submitRequest}
                  disabled={cart.length === 0 || submitting}
                  className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-lg"
               >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
                  Send to Admin
               </button>
            </div>
         </div>

         {/* RIGHT COLUMN: REQUEST LIST */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 w-fit shadow-sm">
               <button 
                 onClick={() => setActiveTab('PENDING')}
                 className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-gray-50'}`}
               >
                 Pending
               </button>
               <button 
                 onClick={() => setActiveTab('HISTORY')}
                 className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-gray-50'}`}
               >
                 History
               </button>
            </div>

            <div className="bg-white rounded-2xl shadow-premium border border-gray-200 overflow-hidden min-h-[500px]">
               {loadingReq ? (
                  <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
               ) : requests.length === 0 ? (
                  <div className="p-24 text-center text-slate-300 flex flex-col items-center justify-center">
                     <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <History className="opacity-20" size={32} />
                     </div>
                     <p className="font-black uppercase tracking-[0.2em] text-[10px]">No {activeTab.toLowerCase()} requests</p>
                  </div>
               ) : (
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-widest border-b border-gray-200">
                           <tr>
                              <th className="px-6 py-4">Request Log</th>
                              <th className="px-6 py-4">SKU / Item</th>
                              <th className="px-6 py-4 text-center">Req Qty</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                <th className="px-6 py-4 text-right">Actions</th>
                              )}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {requests.map(req => (
                              <tr key={req.id} className="hover:bg-slate-50 transition-colors group">
                                 <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900">{req.requesterName || 'Manager'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{new Date(req.createdAt).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="font-black text-slate-900 tracking-tight">{req.partNumber}</div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]">Part Requisition</div>
                                 </td>
                                 <td className="px-6 py-4 text-center font-black text-slate-900 text-base">{formatQty(req.quantityNeeded)}</td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${
                                       req.status === RequestStatus.PENDING ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                       req.status === RequestStatus.ORDERED ? 'bg-teal-50 text-teal-600 border border-teal-100' :
                                       'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                       {req.status}
                                    </span>
                                 </td>
                                 {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                             onClick={() => handleStatusChange([req.id], RequestStatus.ORDERED)}
                                             className="bg-teal-50 hover:bg-teal-100 text-teal-700 p-2.5 rounded-xl transition-all border border-teal-200 active:scale-90"
                                             title="Order Placed"
                                          >
                                             <CheckCircle2 size={16} />
                                          </button>
                                          <button 
                                             onClick={() => handleStatusChange([req.id], RequestStatus.REJECTED)}
                                             className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-2.5 rounded-xl transition-all border border-rose-200 active:scale-90"
                                             title="Decline"
                                          >
                                             <XCircle size={16} />
                                          </button>
                                       </div>
                                    </td>
                                 )}
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default StockRequests;