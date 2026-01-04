
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
  Truck,
  Box,
  LayoutGrid,
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
  
  const [cart, setCart] = useState<{ partNumber: string; name: string; currentStock: number; requestQty: number }[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const stockAlerts = useMemo(() => {
    return inventory
      .filter(i => !i.isArchived && i.quantity <= i.minStockThreshold)
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventory]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term) {
      setSuggestions([]);
      return;
    }
    const matches = inventory.filter(i => 
      i.partNumber.toLowerCase().includes(term.toLowerCase()) || 
      i.name.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 8);
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
        else loadData();
      } else {
        alert("Failed to submit request: " + res.message);
      }
    } catch (e: any) {
      alert("System Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="max-w-6xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1 pt-2">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
              <Truck size={28} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                 Supply Planning
              </h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                {user.role === Role.MANAGER 
                  ? "Procurement Pipeline • Stock Request" 
                  : "Fulfillment Queue • Admin Oversight"}
              </p>
           </div>
        </div>

        <div className="flex bg-slate-200/50 p-1.5 rounded-[1.5rem] border border-slate-200 shadow-inner-soft w-full md:w-auto overflow-x-auto no-scrollbar">
           {(['PENDING', 'SUGGESTIONS', 'HISTORY'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-none md:px-8 px-4 py-3 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${activeTab === tab ? 'bg-white text-slate-900 shadow-soft border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab === 'SUGGESTIONS' ? `Alerts (${stockAlerts.length})` : tab}
              </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* LEFT COLUMN: DRAFTING */}
         <div className="lg:col-span-4 space-y-8">
            
            <div className="bg-[#1E293B] rounded-[2.5rem] p-8 shadow-elevated border border-white/5 flex flex-col h-fit relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
               
               <h3 className="font-black text-white/40 mb-8 flex items-center justify-between uppercase text-[10px] tracking-[0.3em] relative z-10">
                  <span className="flex items-center gap-3"><ShoppingCart size={18} className="text-blue-400" /> PROCUREMENT DRAFT</span>
                  <span className="bg-blue-600 px-3 py-1 rounded-xl text-white font-black shadow-lg">{cart.length}</span>
               </h3>
               
               {cart.length === 0 ? (
                  <div className="text-center text-slate-500 py-24 bg-white/5 border border-dashed border-white/10 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em]">
                    Registry is empty
                  </div>
               ) : (
                  <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto no-scrollbar pr-1 relative z-10">
                     {cart.map(item => (
                        <div key={item.partNumber} className="flex items-center justify-between bg-white/[0.04] p-5 rounded-[1.5rem] border border-white/5 hover:bg-white/[0.08] transition-all">
                           <div className="flex-1 min-w-0 mr-4">
                              <div className="font-black truncate text-white text-[15px] uppercase tracking-tight mb-2">{item.partNumber}</div>
                              <div className="text-[10px] text-white/30 truncate font-black uppercase tracking-widest flex items-center gap-2">
                                <Box size={10} className="opacity-40"/> STOCK: {item.currentStock}
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <input 
                                 type="number" 
                                 className="w-14 px-2 py-2.5 bg-white/10 border border-white/5 rounded-xl text-center text-[13px] font-black text-white focus:ring-2 focus:ring-blue-500/40 outline-none"
                                 value={item.requestQty}
                                 onChange={(e) => updateCartQty(item.partNumber, parseInt(e.target.value) || 0)}
                              />
                              <button onClick={() => removeFromCart(item.partNumber)} className="p-2 text-white/10 hover:text-rose-400 transition-colors">
                                 <Trash2 size={18} />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}

               <button 
                  onClick={submitRequest}
                  disabled={cart.length === 0 || submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-20 shadow-2xl shadow-blue-900/50 relative z-10 active:scale-95 uppercase text-[13px] tracking-widest"
               >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <PackagePlus size={22} />}
                  Transmit Request
               </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-soft">
               <h3 className="font-black text-slate-400 mb-6 uppercase text-[10px] tracking-[0.25em]">Catalog Explorer</h3>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={22} strokeWidth={2.5} />
                  <input 
                     type="text" 
                     className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-[16px] font-black focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none uppercase placeholder:text-slate-200 transition-all shadow-inner-soft"
                     placeholder="Search Part SKU..."
                     value={searchTerm}
                     onChange={e => handleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                     <div className="absolute left-0 right-0 mt-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-elevated z-[100] max-h-80 overflow-y-auto animate-slide-up border border-slate-200/60 p-2">
                        {suggestions.map(s => (
                           <div 
                              key={s.id} 
                              onClick={() => addToRequest(s)}
                              className="px-5 py-5 hover:bg-slate-50 cursor-pointer rounded-[1rem] border-b border-slate-50 last:border-0 flex justify-between items-center group/suggest transition-all duration-200"
                           >
                              <div className="flex-1 min-w-0 pr-6">
                                 <div className="font-black text-slate-900 group-hover/suggest:text-blue-600 transition-colors text-lg tracking-tight truncate uppercase mb-1">{s.partNumber}</div>
                                 <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{s.name}</div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                 <div className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md">
                                    <Box size={12} /> {s.quantity}
                                 </div>
                                 <Plus size={18} className="text-slate-200 group-hover/suggest:text-blue-600 transition-colors" strokeWidth={3} />
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* RIGHT COLUMN: QUEUE / ANALYTICS */}
         <div className="lg:col-span-8 space-y-6">
            
            {activeTab === 'SUGGESTIONS' ? (
                <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col min-h-[650px] animate-fade-in">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-5">
                            <div className="p-3.5 bg-amber-50 rounded-[1.25rem] text-amber-600 shadow-inner">
                                <AlertTriangle size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-sm leading-none mb-1.5">Intelligent Suggestions</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Auto-Detected Shortages</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black bg-amber-600 text-white px-5 py-2.5 rounded-full uppercase tracking-widest shadow-lg">{stockAlerts.length} Critical</span>
                    </div>

                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        {stockAlerts.length === 0 ? (
                            <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft">
                                    <CheckCircle2 className="opacity-10" size={64} />
                                </div>
                                <p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Inventory Saturated</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-10 py-6">Part Description</th>
                                        <th className="px-10 py-6 text-center">Status</th>
                                        <th className="px-10 py-6 text-center">Stock</th>
                                        <th className="px-10 py-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stockAlerts.map(item => {
                                        const isZero = item.quantity === 0;
                                        const inCart = cart.some(c => c.partNumber === item.partNumber);
                                        return (
                                            <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${inCart ? 'opacity-30' : ''}`}>
                                                <td className="px-10 py-6">
                                                    <div className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none mb-2">{item.partNumber}</div>
                                                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate max-w-[280px]">{item.name}</div>
                                                </td>
                                                <td className="px-10 py-6 text-center">
                                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                                                        isZero ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {isZero ? 'Stock Out' : 'Below Min'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-6 text-center">
                                                    <span className="font-black text-slate-900 text-lg tabular-nums">{item.quantity}</span>
                                                    <span className="text-[9px] text-slate-300 font-black uppercase ml-2">/ {item.minStockThreshold}</span>
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    <button 
                                                        onClick={() => addToRequest(item)}
                                                        disabled={inCart}
                                                        className={`p-4 rounded-2xl transition-all shadow-soft active:scale-90 border ${
                                                            inCart ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-blue-600 border-slate-100 hover:border-blue-200'
                                                        }`}
                                                    >
                                                        {inCart ? <CheckCircle2 size={22} /> : <Plus size={22} strokeWidth={3} />}
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
                <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 overflow-hidden min-h-[650px] flex flex-col animate-fade-in">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-5">
                            <div className={`w-3 h-3 rounded-full ${activeTab === 'PENDING' ? 'bg-blue-600 animate-pulse shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-slate-300'}`}></div>
                            <div>
                               <span className="font-black text-slate-900 uppercase tracking-[0.25em] text-sm">{activeTab} QUEUE</span>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Acquisition Log Ledger</p>
                            </div>
                        </div>
                        <button onClick={loadRequests} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl shadow-sm border border-slate-100 transition-all active:rotate-90">
                            <History size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        {loadingReq ? (
                            <div className="p-32 flex flex-col items-center justify-center gap-6">
                                <Loader2 className="animate-spin text-blue-500" size={40} strokeWidth={3} />
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Synchronizing Ledger</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft">
                                    <ClipboardList className="opacity-10" size={64} />
                                </div>
                                <p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Journal Empty</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-10 py-6">Requested By</th>
                                        <th className="px-10 py-6">Reference ID</th>
                                        <th className="px-10 py-6 text-center">Qty</th>
                                        <th className="px-10 py-6 text-center">Process Status</th>
                                        {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                            <th className="px-10 py-6 text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {requests.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-10 py-6">
                                                <div className="font-black text-slate-900 text-base mb-2 uppercase leading-none">{req.requesterName || 'SYSTEM'}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase mt-1.5 flex items-center gap-2 tracking-widest">
                                                    <Calendar size={12} className="opacity-40" /> {new Date(req.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">{req.partNumber}</div>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                                <span className="text-xl font-black text-slate-900 tabular-nums tracking-tighter">{formatQty(req.quantityNeeded)}</span>
                                                <span className="text-[10px] font-black text-slate-300 uppercase ml-2">PCS</span>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                                <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm ring-1 transition-all ${
                                                    req.status === RequestStatus.PENDING ? 'bg-amber-50 text-amber-600 ring-amber-200/40' :
                                                    req.status === RequestStatus.ORDERED ? 'bg-teal-50 text-teal-600 ring-teal-200/40' :
                                                    'bg-rose-50 text-rose-600 ring-rose-200/40'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                                <td className="px-10 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                        <button 
                                                            onClick={() => handleStatusChange([req.id], RequestStatus.ORDERED)}
                                                            className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-2xl shadow-xl shadow-teal-100 active:scale-90 transition-all"
                                                        >
                                                            <CheckCircle2 size={20} strokeWidth={2.5} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleStatusChange([req.id], RequestStatus.REJECTED)}
                                                            className="bg-rose-600 hover:bg-rose-700 text-white p-4 rounded-2xl shadow-xl shadow-rose-100 active:scale-90 transition-all"
                                                        >
                                                            <XCircle size={20} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
