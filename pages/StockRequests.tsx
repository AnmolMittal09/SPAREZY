
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
  ArrowUpRight,
  Box,
  Truck
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
        else loadData(); // Refresh inventory context
      } else {
        alert("Failed to submit request: " + res.message);
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
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1 pt-2">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-100">
              <Truck size={28} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                 Supply Requisition
              </h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.25em]">
                {user.role === Role.MANAGER 
                  ? "Internal Logistics • Procurement Flow" 
                  : "Fulfillment Pipeline • Supply Chain"}
              </p>
           </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-200/30 p-1.5 rounded-[1.5rem] border border-slate-200/50 shadow-inner-soft w-full md:w-auto overflow-x-auto no-scrollbar">
           <button 
             onClick={() => setActiveTab('PENDING')}
             className={`flex-none md:px-6 px-4 py-3 rounded-[1.15rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${activeTab === 'PENDING' ? 'bg-white text-blue-600 shadow-elevated ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Active
           </button>
           <button 
             onClick={() => setActiveTab('SUGGESTIONS')}
             className={`flex-none md:px-6 px-4 py-3 rounded-[1.15rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${activeTab === 'SUGGESTIONS' ? 'bg-white text-amber-600 shadow-elevated ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Alerts <span className="ml-1.5 px-1.5 py-0.5 bg-amber-50 rounded-md text-[9px]">{stockAlerts.length}</span>
           </button>
           <button 
             onClick={() => setActiveTab('HISTORY')}
             className={`flex-none md:px-6 px-4 py-3 rounded-[1.15rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-elevated ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
           >
             History
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* LEFT COLUMN: DRAFT & LOOKUP */}
         <div className="lg:col-span-4 space-y-8">
            
            {/* 1. Request Draft - Softer Dark Theme */}
            <div className="bg-[#1E293B] rounded-[2.5rem] p-8 shadow-elevated relative overflow-hidden flex flex-col h-fit border border-white/5 group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
               <h3 className="font-black text-white/40 mb-8 flex items-center justify-between uppercase text-[10px] tracking-[0.3em] relative z-10">
                  <span className="flex items-center gap-3"><ShoppingCart size={18} className="text-blue-400" /> PROCUREMENT DRAFT</span>
                  <span className="bg-white/10 px-3 py-1 rounded-xl text-white font-black">{cart.length}</span>
               </h3>
               
               {cart.length === 0 ? (
                  <div className="text-center text-slate-500 py-20 bg-white/5 border border-dashed border-white/10 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] animate-fade-in">
                    Basket is empty
                  </div>
               ) : (
                  <div className="space-y-4 mb-8 max-h-[450px] overflow-y-auto no-scrollbar pr-1 relative z-10">
                     {cart.map(item => (
                        <div key={item.partNumber} className="flex items-center justify-between bg-white/[0.03] p-5 rounded-[1.5rem] border border-white/10 group/item hover:bg-white/[0.06] transition-all duration-300">
                           <div className="flex-1 min-w-0 mr-4">
                              <div className="font-black truncate text-white text-[15px] uppercase tracking-tight leading-none mb-2">{item.partNumber}</div>
                              <div className="text-[10px] text-white/30 truncate font-black uppercase tracking-widest flex items-center gap-2">
                                <Box size={10} className="text-white/20"/> STK: {item.currentStock}
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <input 
                                 type="number" 
                                 className="w-14 px-2 py-2.5 bg-white/10 border border-white/5 rounded-xl text-center text-[13px] font-black text-white focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
                                 value={item.requestQty}
                                 onChange={(e) => updateCartQty(item.partNumber, parseInt(e.target.value) || 0)}
                              />
                              <button onClick={() => removeFromCart(item.partNumber)} className="p-2.5 text-white/10 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90">
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
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-20 shadow-2xl shadow-blue-900/50 relative z-10 active:scale-[0.98] uppercase text-sm tracking-[0.1em]"
               >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <PackagePlus size={22} />}
                  Dispatch Request
               </button>
            </div>

            {/* 2. Manual Lookup - Cleaner Borderless feel */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-soft group">
               <h3 className="font-black text-slate-400 mb-6 uppercase text-[10px] tracking-[0.25em] ml-1">CATALOG EXPLORER</h3>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} strokeWidth={2.5} />
                  <input 
                     type="text" 
                     className="w-full pl-12 pr-4 py-4 bg-slate-100/50 border-2 border-transparent rounded-[1.5rem] text-[16px] font-black focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none uppercase placeholder:text-slate-300 shadow-inner-soft transition-all"
                     placeholder="Search SKU..."
                     value={searchTerm}
                     onChange={e => handleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                     <div className="absolute left-0 right-0 mt-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-elevated z-[100] max-h-80 overflow-y-auto animate-slide-up border border-slate-200/60 p-2">
                        {suggestions.map(s => {
                           const isLow = s.quantity <= s.minStockThreshold;
                           const isZero = s.quantity === 0;
                           
                           return (
                             <div 
                                key={s.id} 
                                onClick={() => addToRequest(s)}
                                className="px-5 py-5 hover:bg-slate-50 cursor-pointer rounded-[1rem] border-b border-slate-50 last:border-0 flex justify-between items-center group/suggest transition-all duration-200"
                             >
                                <div className="flex-1 min-w-0 pr-6">
                                   <div className="flex items-center gap-3 mb-2">
                                      <div className="font-black text-slate-900 group-hover/suggest:text-blue-600 transition-colors text-lg tracking-tight truncate uppercase leading-none">{s.partNumber}</div>
                                      <span className={`flex-none text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border shadow-sm ${
                                          isZero ? 'bg-rose-50 text-rose-500 border-rose-100' :
                                          isLow ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                          'bg-teal-50 text-teal-600 border-teal-100'
                                      }`}>
                                         {isZero ? 'Out' : isLow ? 'Low' : 'OK'}
                                      </span>
                                   </div>
                                   <div className="text-[11px] text-slate-400 font-bold uppercase truncate leading-none tracking-tight">{s.name}</div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                   <div className={`text-[12px] font-black flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 ${isZero ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-500'}`}>
                                      <Box size={14} strokeWidth={2.5} /> {s.quantity}
                                   </div>
                                   <div className="w-8 h-8 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center opacity-0 group-hover/suggest:opacity-100 transition-all transform translate-x-2 group-hover/suggest:translate-x-0 active:scale-90">
                                      <Plus size={20} strokeWidth={3} />
                                   </div>
                                </div>
                             </div>
                           )
                        })}
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* RIGHT COLUMN: MAIN CONTENT AREA */}
         <div className="lg:col-span-8 space-y-6">
            
            {activeTab === 'SUGGESTIONS' ? (
                <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col min-h-[650px] animate-fade-in">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-5">
                            <div className="p-3.5 bg-amber-50 rounded-[1.25rem] text-amber-600 shadow-inner">
                                <AlertTriangle size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-sm leading-none mb-1.5">Stock Replenishment Alerts</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Priority Requisition List</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black bg-slate-900 text-white px-5 py-2.5 rounded-full uppercase tracking-widest shadow-lg">{stockAlerts.length} Suggestions</span>
                    </div>

                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        {stockAlerts.length === 0 ? (
                            <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft">
                                    <CheckCircle2 className="opacity-10" size={64} />
                                </div>
                                <p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Inventory Saturated</p>
                                <p className="text-[10px] font-bold text-slate-300 mt-4 uppercase tracking-[0.2em]">No urgent replenishment needed</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-10 py-6">Part Details</th>
                                        <th className="px-10 py-6 text-center">Status</th>
                                        <th className="px-10 py-6 text-center">Available</th>
                                        <th className="px-10 py-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stockAlerts.map(item => {
                                        const isZero = item.quantity === 0;
                                        const inCart = cart.some(c => c.partNumber === item.partNumber);
                                        return (
                                            <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${inCart ? 'opacity-40' : ''}`}>
                                                <td className="px-10 py-6">
                                                    <div className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none mb-2 group-hover:text-blue-600 transition-colors">{item.partNumber}</div>
                                                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate max-w-[280px]">{item.name}</div>
                                                </td>
                                                <td className="px-10 py-6 text-center">
                                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                                                        isZero ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {isZero ? 'Critical Out' : 'Low Threshold'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-6 text-center">
                                                    <span className="font-black text-slate-900 text-lg tabular-nums">{item.quantity}</span>
                                                    <span className="text-[9px] text-slate-300 font-black uppercase ml-2 tracking-widest">/ {item.minStockThreshold}</span>
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    <button 
                                                        onClick={() => addToRequest(item)}
                                                        disabled={inCart}
                                                        className={`p-4 rounded-2xl transition-all shadow-soft active:scale-90 border ${
                                                            inCart ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-blue-600 border-slate-100 hover:border-blue-200 hover:shadow-lg'
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
                            <div className={`w-3 h-3 rounded-full ${activeTab === 'PENDING' ? 'bg-blue-600 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-300'}`}></div>
                            <div>
                               <span className="font-black text-slate-900 uppercase tracking-[0.25em] text-sm">{activeTab} QUEUE</span>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">System Audit Ledger</p>
                            </div>
                        </div>
                        <button onClick={loadRequests} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all active:rotate-180 duration-500 shadow-sm border border-slate-100">
                            <History size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        {loadingReq ? (
                            <div className="p-32 flex flex-col items-center justify-center gap-6">
                                <Loader2 className="animate-spin text-blue-500" size={40} strokeWidth={3} />
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Syncing Ledger</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft">
                                    <ClipboardList className="opacity-10" size={64} />
                                </div>
                                <p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Journal is empty</p>
                                <p className="text-[10px] font-bold text-slate-300 mt-4 uppercase tracking-[0.2em]">No recorded requests in this session</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                                        <tr>
                                            <th className="px-10 py-6">Source Origin</th>
                                            <th className="px-10 py-6">Reference ID</th>
                                            <th className="px-10 py-6 text-center">Unit Count</th>
                                            <th className="px-10 py-6 text-center">Protocol Status</th>
                                            {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                                <th className="px-10 py-6 text-right">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {requests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-10 py-6">
                                                    <div className="font-black text-slate-900 tracking-tighter leading-none uppercase text-base mb-2 group-hover:text-blue-600 transition-colors">{req.requesterName || 'SYSTEM'}</div>
                                                    <div className="text-[10px] text-slate-400 font-black uppercase mt-1.5 flex items-center gap-2 tracking-widest">
                                                        <Calendar size={12} className="text-slate-300" /> {new Date(req.createdAt).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none mb-1.5">{req.partNumber}</div>
                                                    <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-none">Internal Requisition</div>
                                                </td>
                                                <td className="px-10 py-6 text-center">
                                                    <span className="text-xl font-black text-slate-900 tabular-nums tracking-tighter">{formatQty(req.quantityNeeded)}</span>
                                                    <span className="text-[9px] font-black text-slate-300 uppercase ml-2 tracking-widest">PCS</span>
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
                                                                title="Process Order"
                                                            >
                                                                <CheckCircle2 size={20} strokeWidth={2.5} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleStatusChange([req.id], RequestStatus.REJECTED)}
                                                                className="bg-rose-600 hover:bg-rose-700 text-white p-4 rounded-2xl shadow-xl shadow-rose-100 active:scale-90 transition-all"
                                                                title="Dismiss Request"
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
