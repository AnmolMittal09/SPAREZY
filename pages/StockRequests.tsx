
import React, { useEffect, useState, useMemo } from 'react';
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
  History,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Calendar,
  Layers,
  ArrowUpRight
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
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'SUGGESTIONS'>('PENDING');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'PENDING' || activeTab === 'HISTORY') {
      loadRequests();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoadingInv(true);
    try {
      const inv = await fetchInventory();
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInv(false);
    }
  };

  const loadRequests = async () => {
    setLoadingReq(true);
    try {
      const all = await fetchStockRequests();
      if (activeTab === 'PENDING') {
        setRequests(all.filter(r => r.status === RequestStatus.PENDING));
      } else {
        setRequests(all.filter(r => r.status !== RequestStatus.PENDING));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReq(false);
    }
  };

  // --- AUTOMATED SUGGESTIONS (Out of Stock / Low Stock - Non-Archived) ---
  const stockAlerts = useMemo(() => {
    return inventory
      .filter(i => !i.isArchived && i.quantity <= i.minStockThreshold)
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventory]);

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

  const addToRequest = (item: Partial<StockItem>, qty: number = 5) => {
    if (!item.partNumber) return;
    if (cart.some(c => c.partNumber === item.partNumber)) return;
    setCart(prev => [...prev, {
      partNumber: item.partNumber!,
      name: item.name || 'Spare Part',
      currentStock: item.quantity || 0,
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

    try {
      const res = await createStockRequests(payload);
      if (res.success) {
        alert("Stock request submitted successfully!");
        setCart([]);
        if (activeTab !== 'SUGGESTIONS') loadRequests();
        else loadData(); // Refresh inventory context
      } else {
        alert("Failed to send request: " + res.message);
      }
    } catch (e: any) {
      alert("System Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
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

  if (loadingInv && inventory.length === 0) return <TharLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
           <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <ClipboardList className="text-blue-600" /> Stock Requisition
           </h1>
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
             {user.role === Role.MANAGER 
               ? "Internal Procurement • Supply Pipeline" 
               : "Supply Control • Fulfillment Queue"}
           </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-soft w-full md:w-auto overflow-x-auto no-scrollbar">
           <button 
             onClick={() => setActiveTab('PENDING')}
             className={`flex-none md:px-6 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             Active
           </button>
           <button 
             onClick={() => setActiveTab('SUGGESTIONS')}
             className={`flex-none md:px-6 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SUGGESTIONS' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             Alerts ({stockAlerts.length})
           </button>
           <button 
             onClick={() => setActiveTab('HISTORY')}
             className={`flex-none md:px-6 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             History
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         
         {/* LEFT COLUMN: DRAFT & LOOKUP */}
         <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Request Draft */}
            <div className="bg-slate-900 rounded-3xl p-6 shadow-elevated relative overflow-hidden flex flex-col h-fit">
               <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
               <h3 className="font-black text-white/50 mb-6 flex items-center justify-between uppercase text-[10px] tracking-[0.2em] relative z-10">
                  <span className="flex items-center gap-2"><ShoppingCart size={16} /> Current Draft</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-lg text-white">{cart.length}</span>
               </h3>
               
               {cart.length === 0 ? (
                  <div className="text-center text-slate-500 py-16 bg-white/5 border border-dashed border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest">
                    No items selected
                  </div>
               ) : (
                  <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto no-scrollbar pr-1 relative z-10">
                     {cart.map(item => (
                        <div key={item.partNumber} className="flex items-center justify-between text-sm bg-white/5 p-4 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors">
                           <div className="flex-1 min-w-0 mr-3">
                              <div className="font-black truncate text-white uppercase tracking-tight leading-none mb-1">{item.partNumber}</div>
                              <div className="text-[9px] text-white/40 truncate font-bold uppercase tracking-widest">In Stock: {item.currentStock}</div>
                           </div>
                           <div className="flex items-center gap-3">
                              <input 
                                 type="number" 
                                 className="w-12 px-1 py-2 bg-white/10 border border-white/10 rounded-xl text-center text-xs font-black text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                 value={item.requestQty}
                                 onChange={(e) => updateCartQty(item.partNumber, parseInt(e.target.value) || 0)}
                              />
                              <button onClick={() => removeFromCart(item.partNumber)} className="p-2 text-white/20 hover:text-rose-400 transition-colors">
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}

               <button 
                  onClick={submitRequest}
                  disabled={cart.length === 0 || submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-xl shadow-blue-900/50 relative z-10 active:scale-95"
               >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={20} />}
                  Submit Requisition
               </button>
            </div>

            {/* 2. Manual Lookup */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-soft">
               <h3 className="font-black text-slate-400 mb-4 uppercase text-[10px] tracking-widest">Quick SKU Add</h3>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                     type="text" 
                     className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 outline-none uppercase placeholder:text-slate-300"
                     placeholder="Search to add..."
                     value={searchTerm}
                     onChange={e => handleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                     <div className="absolute left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-elevated z-50 max-h-56 overflow-y-auto animate-slide-up">
                        {suggestions.map(s => (
                           <div 
                              key={s.id} 
                              onClick={() => addToRequest(s)}
                              className="px-5 py-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 flex justify-between items-center group transition-colors"
                           >
                              <div className="flex-1 min-w-0 pr-4">
                                 <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{s.partNumber}</div>
                                 <div className="text-[9px] text-slate-400 font-bold uppercase truncate">{s.name}</div>
                              </div>
                              <Plus size={16} className="text-slate-300 group-hover:text-blue-600" />
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* RIGHT COLUMN: MAIN CONTENT AREA */}
         <div className="lg:col-span-8 space-y-4">
            
            {activeTab === 'SUGGESTIONS' ? (
                <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden flex flex-col min-h-[600px] animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Stock Replenishment Alerts</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Items at risk of running out</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black bg-amber-100 text-amber-600 px-3 py-1 rounded-full uppercase">{stockAlerts.length} Suggestions</span>
                    </div>

                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        {stockAlerts.length === 0 ? (
                            <div className="p-32 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
                                    <CheckCircle2 className="opacity-10" size={48} />
                                </div>
                                <p className="font-black uppercase tracking-[0.4em] text-[12px] text-slate-300">Inventory Healthy</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">Part Details</th>
                                        <th className="px-8 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-center">In Stock</th>
                                        <th className="px-8 py-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stockAlerts.map(item => {
                                        const isZero = item.quantity === 0;
                                        const inCart = cart.some(c => c.partNumber === item.partNumber);
                                        return (
                                            <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${inCart ? 'opacity-40' : ''}`}>
                                                <td className="px-8 py-5">
                                                    <div className="font-black text-slate-900 text-base tracking-tighter uppercase">{item.partNumber}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate max-w-[200px]">{item.name}</div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                                        isZero ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {isZero ? 'Out of Stock' : 'Low Stock'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="font-black text-slate-900">{item.quantity}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase ml-1">/{item.minStockThreshold}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button 
                                                        onClick={() => addToRequest(item)}
                                                        disabled={inCart}
                                                        className={`p-3 rounded-2xl transition-all shadow-sm active:scale-90 border ${
                                                            inCart ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-blue-600 border-slate-100 hover:border-blue-200'
                                                        }`}
                                                    >
                                                        {inCart ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden min-h-[600px] flex flex-col animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${activeTab === 'PENDING' ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'}`}></div>
                            <span className="font-black text-slate-900 uppercase tracking-widest text-[11px]">{activeTab} LOGS</span>
                        </div>
                        <button onClick={loadRequests} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            <History size={18} />
                        </button>
                    </div>

                    <div className="flex-1">
                        {loadingReq ? (
                            <div className="p-24 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="animate-spin text-blue-500" size={32} />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Synchronizing</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="p-32 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
                                    <ClipboardList className="opacity-10" size={48} />
                                </div>
                                <p className="font-black uppercase tracking-[0.4em] text-[12px] text-slate-300">No requests found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">Source</th>
                                            <th className="px-8 py-5">Part Number</th>
                                            <th className="px-8 py-5 text-center">Qty</th>
                                            <th className="px-8 py-5 text-center">Status</th>
                                            {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                                <th className="px-8 py-5 text-right">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {requests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="font-black text-slate-900 tracking-tight leading-none uppercase">{req.requesterName || 'MANAGER'}</div>
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-1.5">
                                                        <Calendar size={10} /> {new Date(req.createdAt).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="font-black text-slate-900 text-base tracking-tighter uppercase group-hover:text-blue-600 transition-colors">{req.partNumber}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Req</div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="text-lg font-black text-slate-900 tabular-nums">{formatQty(req.quantityNeeded)}</span>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ring-1 ${
                                                        req.status === RequestStatus.PENDING ? 'bg-amber-50 text-amber-600 ring-amber-200/40' :
                                                        req.status === RequestStatus.ORDERED ? 'bg-teal-50 text-teal-600 ring-teal-200/40' :
                                                        'bg-rose-50 text-rose-600 ring-rose-200/40'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                            <button 
                                                                onClick={() => handleStatusChange([req.id], RequestStatus.ORDERED)}
                                                                className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-2xl shadow-lg shadow-teal-100 active:scale-90 transition-all"
                                                                title="Mark Ordered"
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleStatusChange([req.id], RequestStatus.REJECTED)}
                                                                className="bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-2xl shadow-lg shadow-rose-100 active:scale-90 transition-all"
                                                                title="Reject"
                                                            >
                                                                <XCircle size={18} />
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
            )}
         </div>
      </div>
    </div>
  );
};

export default StockRequests;
