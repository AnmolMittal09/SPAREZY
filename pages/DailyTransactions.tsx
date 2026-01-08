
import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Customer, Brand, TransactionStatus } from '../types';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  PackagePlus,
  // Added missing 'Package' icon import
  Package,
  ArrowLeft,
  ArrowRight,
  Percent,
  Sparkles,
  CircleSlash,
  X,
  Check,
  Box,
  AlertTriangle
} from 'lucide-react';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const DailyTransactions: React.FC<any> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const loadBaseData = async () => {
    const [inv] = await Promise.all([fetchInventory()]);
    setInventory(inv);
  };

  useEffect(() => { loadBaseData(); }, [mode]);
  
  useEffect(() => { 
    if (onSearchToggle) onSearchToggle(showMobileSearch); 
  }, [showMobileSearch, onSearchToggle]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       let filtered = inventory.filter(i => i.partNumber.toLowerCase().includes(val.toLowerCase()) || i.name.toLowerCase().includes(val.toLowerCase()));
       if (selectedBrand !== 'ALL') filtered = filtered.filter(i => i.brand === selectedBrand);
       setSuggestions(filtered.slice(0, 30));
    } else setSuggestions([]);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) { 
          updateQty(existing.tempId, 1); 
          resetSearch(); 
          return; 
      }
      
      const initialDiscount = mode === 'PURCHASE' ? (item.brand === Brand.MAHINDRA ? 19.36 : 12) : 0;
      const newItem = {
          tempId: Math.random().toString(36).substring(2),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode,
          quantity: 1,
          mrp: item.price,
          discount: initialDiscount,
          price: item.price * (1 - initialDiscount / 100),
          customerName: customerName,
          brand: item.brand,
          stockLevel: item.quantity // Track for validation
      };
      setCart(prev => [...prev, newItem]); 
      resetSearch();
  };

  const resetSearch = () => { setSearch(''); setSuggestions([]); setShowMobileSearch(false); };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = Math.max(1, item.quantity + delta);
              if (mode === 'SALES' && newQty > item.stockLevel) {
                  newQty = item.stockLevel;
              }
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const updateQtyDirect = (id: string, value: string) => {
      const val = parseInt(value) || 0;
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = val;
              if (mode === 'SALES' && newQty > item.stockLevel) {
                  newQty = item.stockLevel;
              }
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const updatePriceInfo = (id: string, field: 'mrp' | 'discount', value: string) => {
      const val = parseFloat(value) || 0;
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              const updated = { ...item, [field]: val };
              updated.price = updated.mrp * (1 - updated.discount / 100);
              return updated;
          }
          return item;
      }));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    const payload = cart.map(item => ({
       partNumber: item.partNumber,
       type: mode as TransactionType,
       quantity: item.quantity,
       price: item.price,
       paidAmount: mode === 'SALES' ? 0 : (item.price * item.quantity),
       customerName: customerName || 'Walk-in',
       createdByRole: user.role,
       createdByName: user.name
    }));

    const res = await createBulkTransactions(payload);
    setLoading(false);
    if (res.success) {
      setCart([]);
      setCustomerName('');
      alert("Session committed successfully.");
    } else {
      alert("Failed to commit: " + res.message);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-700' : mode === 'PURCHASE' ? 'bg-slate-950' : 'bg-blue-700';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in overflow-hidden relative font-['Plus_Jakarta_Sans']">
       
       {/* MOBILE UI */}
       <div className="flex lg:hidden flex-col h-full bg-slate-50 relative overflow-hidden">
          
          {/* Search Header */}
          <div className={`p-4 bg-white border-b border-slate-100 transition-all duration-300 z-[100] ${showMobileSearch ? 'fixed inset-0 h-screen' : 'relative'}`}>
              <div className="flex items-center gap-3">
                 {showMobileSearch && (
                   <button onClick={() => setShowMobileSearch(false)} className="p-2 text-slate-400 active:scale-90"><ArrowLeft size={24}/></button>
                 )}
                 <div className="relative flex-1">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${showMobileSearch ? 'text-blue-600' : 'text-slate-400'}`} size={20} strokeWidth={2.5}/>
                    <input 
                      type="text" 
                      placeholder="Scan SKU or Part Name..." 
                      className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-2xl font-black text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase text-[15px] shadow-inner-soft"
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => setShowMobileSearch(true)}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><X size={18}/></button>
                    )}
                 </div>
              </div>

              {showMobileSearch && (
                <div className="mt-4 flex flex-col h-full overflow-hidden no-scrollbar">
                   <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
                      {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                        <button key={b} onClick={() => setSelectedBrand(b)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedBrand === b ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>{b}</button>
                      ))}
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-3 pb-24 no-scrollbar">
                      {suggestions.length > 0 ? (
                        suggestions.map(item => (
                          <button key={item.id} onClick={() => addToCart(item)} className="w-full p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-soft flex items-center justify-between active:scale-[0.98] transition-all group">
                             <div className="flex-1 min-w-0 pr-4 text-left">
                                <div className="font-black text-slate-900 text-lg uppercase tracking-tight mb-1">{item.partNumber}</div>
                                <div className="text-[11px] text-slate-400 font-bold uppercase truncate">{item.name}</div>
                                <div className="flex items-center gap-2 mt-2">
                                   <Box size={10} className="text-slate-300"/>
                                   <span className={`text-[10px] font-black uppercase ${item.quantity <= item.minStockThreshold ? 'text-amber-600' : 'text-slate-500'}`}>Stock: {fd(item.quantity)}</span>
                                </div>
                             </div>
                             <div className="text-right flex flex-col items-end gap-2">
                                <div className="font-black text-slate-900">₹{item.price.toLocaleString()}</div>
                                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg group-active:bg-blue-700"><Plus size={18} strokeWidth={3}/></div>
                             </div>
                          </button>
                        ))
                      ) : search.length > 0 ? (
                        <div className="py-20 text-center text-slate-300">
                           <CircleSlash size={48} className="mx-auto mb-4 opacity-10" />
                           <p className="font-black text-[10px] uppercase tracking-widest">No Matches Found</p>
                        </div>
                      ) : (
                        <div className="py-20 text-center text-slate-300">
                           <Sparkles size={48} className="mx-auto mb-4 opacity-10" />
                           <p className="font-black text-[10px] uppercase tracking-widest">Start Typing To Scan Ledger</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
          </div>

          {/* Mobile Main Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-32">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                   <PackagePlus size={80} className="mb-6 opacity-10" />
                   <p className="font-black text-[11px] uppercase tracking-[0.4em] text-center leading-relaxed">Manual Protocol Idle<br/><span className="text-slate-400 opacity-60">Scan parts to begin entry</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Draft Queue ({fd(cart.length)})</span>
                      <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-2 py-1 rounded transition-colors">Flush Session</button>
                   </div>
                   {cart.map(item => (
                      <div key={item.tempId} className="p-6 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-premium flex flex-col gap-5 animate-slide-up">
                         <div className="flex justify-between items-start">
                            <div className="min-w-0 pr-4">
                               <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 shadow-blue-100' : 'bg-red-600 shadow-red-100'}`}>{item.brand.slice(0,3)}</span>
                                  <div className="font-black text-slate-950 text-[17px] tracking-tighter uppercase truncate leading-none">{item.partNumber}</div>
                               </div>
                               <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{item.name}</div>
                            </div>
                            <div className="text-right flex-none">
                               <p className="text-[19px] font-black text-slate-900 tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</p>
                               <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Net Value</span>
                            </div>
                         </div>

                         {/* QTY & PRICE (MOBILE) */}
                         <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-50">
                            <div className="flex flex-col gap-2">
                               <div className="flex items-center justify-between px-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</span>
                                  {mode === 'SALES' && <span className="text-[8px] font-black text-teal-600 uppercase">Avl: {fd(item.stockLevel)}</span>}
                               </div>
                               <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner-soft">
                                  <button onClick={() => updateQty(item.tempId, -1)} className="w-11 h-11 bg-white text-slate-400 rounded-xl flex items-center justify-center shadow-soft active:scale-90 transition-all"><Minus size={16} strokeWidth={3}/></button>
                                  <input 
                                    type="number" 
                                    className="w-full bg-transparent text-center font-black text-slate-950 outline-none tabular-nums text-lg"
                                    value={item.quantity}
                                    onChange={(e) => updateQtyDirect(item.tempId, e.target.value)}
                                  />
                                  <button onClick={() => updateQty(item.tempId, 1)} className="w-11 h-11 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"><Plus size={16} strokeWidth={3}/></button>
                               </div>
                            </div>
                            <div className="flex flex-col gap-2">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">MRP Rate</span>
                               <div className="relative group">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₹</span>
                                  <input 
                                     type="number" 
                                     className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-8 pr-3 py-3.5 text-[15px] font-black text-slate-950 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner-soft"
                                     value={item.mrp}
                                     onChange={(e) => updatePriceInfo(item.tempId, 'mrp', e.target.value)}
                                  />
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 shadow-inner-soft">
                               <Percent size={12} className="text-slate-400" strokeWidth={3}/>
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Disc</span>
                               <input 
                                  type="number" 
                                  className="w-12 bg-transparent font-black text-slate-900 outline-none text-right text-xs"
                                  value={item.discount}
                                  onChange={(e) => updatePriceInfo(item.tempId, 'discount', e.target.value)}
                               />
                               <span className="text-[10px] font-black text-slate-300">%</span>
                            </div>
                            <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="p-3.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"><Trash2 size={20}/></button>
                         </div>
                      </div>
                   ))}
                </div>
              )}
          </div>

          {/* Floating Action Bar (Mobile) */}
          {cart.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 shadow-[0_-20px_50px_rgba(0,0,0,0.06)] z-[90] pb-safe animate-slide-up">
               <div className="bg-slate-950 rounded-[2.5rem] p-6 text-white shadow-2xl flex flex-col gap-5 border border-white/5">
                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-1 block ml-2">Transaction Entity</span>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4.5 bg-white/[0.03] border border-white/10 rounded-2xl text-[16px] font-black outline-none focus:border-blue-500 transition-all placeholder:text-white/20 uppercase shadow-inner tracking-tight"
                      placeholder="Verified Receiver Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between px-1 mt-1">
                      <div className="flex flex-col">
                         <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">REALIZED TOTAL</p>
                         <p className="text-3xl font-black tracking-tighter tabular-nums text-white">₹{totalAmount.toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-10 py-5 rounded-[1.75rem] font-black text-[13px] uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all ${accentColor} border border-white/10 disabled:opacity-30`}
                      >
                         {loading ? <Loader2 className="animate-spin" size={22} /> : <><Check size={22} strokeWidth={4}/> COMMIT</>}
                      </button>
                  </div>
               </div>
            </div>
          )}
       </div>

       {/* DESKTOP UI */}
       <div className="hidden lg:grid grid-cols-12 gap-8 h-full p-3 bg-slate-50/30">
           <div className="col-span-7 bg-white rounded-[3.5rem] shadow-premium border-2 border-slate-200 flex flex-col overflow-hidden relative">
               <div className="p-10 border-b-2 border-slate-100 bg-slate-50 space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                   <div className="flex items-center justify-between relative z-10">
                      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border-2 border-slate-200 w-fit shadow-inner-soft">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                             <button key={b} onClick={() => setSelectedBrand(b)} className={`px-10 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${selectedBrand === b ? 'bg-slate-950 text-white shadow-xl' : 'text-slate-500 hover:text-slate-950'}`}>{b}</button>
                          ))}
                      </div>
                      <div className="flex items-center gap-4">
                         <div className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border-2 transition-all shadow-sm ${mode === 'SALES' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {mode} PROTOCOL
                         </div>
                         <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin opacity-0"></div>
                      </div>
                   </div>
                   <div className="relative group z-10">
                       <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-950 transition-transform group-focus-within:scale-110" size={36} strokeWidth={3.5} />
                       <input 
                         type="text" 
                         className="w-full pl-22 pr-8 py-9 bg-white border-2 border-slate-200 rounded-[2.5rem] text-4xl font-black text-slate-950 placeholder:text-slate-200 focus:border-slate-950 focus:ring-12 focus:ring-slate-950/5 outline-none transition-all uppercase tracking-tighter shadow-soft" 
                         placeholder="SCAN SKU CODE..." 
                         value={search} 
                         onChange={e => handleSearch(e.target.value)}
                       />
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-white relative">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-6 pb-20">
                         {suggestions.map(item => (
                            <button key={item.id} onClick={() => addToCart(item)} className="group/btn text-left p-8 rounded-[2.5rem] border-2 border-slate-100 bg-white hover:border-slate-950 hover:shadow-elevated transition-all active:scale-[0.98] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-slate-950 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                                <div className="flex justify-between items-start mb-4">
                                   <div className="space-y-1.5">
                                      <span className="font-black text-2xl text-slate-950 tracking-tighter uppercase leading-none">{item.partNumber}</span>
                                      <div className="flex items-center gap-2">
                                         <Box size={12} className="text-slate-300"/>
                                         <span className={`text-[10px] font-black uppercase ${item.quantity <= item.minStockThreshold ? 'text-amber-600' : 'text-slate-400'}`}>Ledger: {fd(item.quantity)}</span>
                                      </div>
                                   </div>
                                   <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 shadow-sm ${item.quantity > 0 ? 'bg-teal-700 text-white border-teal-800' : 'bg-rose-700 text-white border-rose-800'}`}>{item.quantity > 0 ? 'AVL' : 'OUT'}</span>
                                </div>
                                <div className="text-[14px] text-slate-700 font-extrabold truncate mb-8 uppercase tracking-tight opacity-80">{item.name}</div>
                                <div className="flex justify-between items-center">
                                   <div className="font-black text-3xl text-slate-900 tracking-tighter tabular-nums">₹{item.price.toLocaleString()}</div>
                                   <div className="p-4 bg-slate-950 text-white rounded-2xl shadow-xl opacity-0 translate-x-4 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all"><Plus size={22} strokeWidth={4}/></div>
                                </div>
                            </button>
                         ))}
                      </div>
                  ) : <div className="flex flex-col items-center justify-center h-full text-slate-200">
                      <PackagePlus size={100} strokeWidth={2.5} className="mb-8 opacity-10" />
                      <p className="font-black text-slate-300 uppercase tracking-[0.5em] text-sm">Protocol Scanner Idle</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Awaiting Ledger Identification</p>
                  </div>}
               </div>
           </div>

           <div className="col-span-5 bg-slate-950 rounded-[3.5rem] shadow-elevated flex flex-col overflow-hidden text-white border-2 border-slate-900 relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full -mr-48 -mt-48 blur-[100px] pointer-events-none"></div>
                
                <div className="p-12 border-b-2 border-white/5 flex justify-between items-center relative z-10">
                    <h2 className="font-black text-3xl tracking-tighter flex items-center gap-5 uppercase">
                       <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/50"><ShoppingCart size={32} strokeWidth={3} className="text-white" /></div>
                       Active Cart
                    </h2>
                    <span className="bg-white/10 text-white/80 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-white/10 shadow-inner">{fd(cart.length)} Assets Logged</span>
                </div>

                <div className="p-12 space-y-10 relative z-10">
                    <div className="group">
                        <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] mb-4 block ml-3 group-focus-within:text-blue-400 transition-colors">Target Account Holder</span>
                        <input 
                          type="text" 
                          className="w-full px-10 py-6 bg-white/[0.04] border-2 border-white/10 rounded-[2rem] text-2xl font-black text-white outline-none focus:border-blue-500 focus:bg-white/[0.08] focus:ring-20 focus:ring-blue-500/5 transition-all placeholder:text-white/10 uppercase tracking-tighter shadow-2xl" 
                          placeholder="Verified Entity Name" 
                          value={customerName} 
                          onChange={e => setCustomerName(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-4 space-y-6 no-scrollbar relative z-10">
                    {cart.length === 0 ? (
                       <div className="py-20 text-center opacity-20">
                          {/* Fixed: Added missing 'Package' icon import */}
                          <Package size={48} className="mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Registry Empty</p>
                       </div>
                    ) : cart.map((item, idx) => (
                        <div key={item.tempId} className="p-8 rounded-[3rem] border-2 border-white/5 bg-white/[0.02] flex flex-col gap-6 animate-fade-in hover:bg-white/[0.05] hover:border-white/10 transition-all group/item shadow-soft relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 text-[50px] font-black text-white/[0.02] leading-none select-none pointer-events-none">{fd(idx + 1)}</div>
                            <div className="flex justify-between items-start relative">
                                <div className="min-w-0 pr-6 flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                       <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg text-white tracking-widest uppercase shadow-lg ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.slice(0,3)}</span>
                                       <div className="font-black text-white text-2xl tracking-tighter uppercase leading-none">{item.partNumber}</div>
                                    </div>
                                    <div className="text-[13px] text-white/40 font-bold uppercase truncate tracking-tight">{item.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-white text-3xl tracking-tighter tabular-nums leading-none mb-1.5">₹{(item.price * item.quantity).toLocaleString()}</div>
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Net Item Total</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 relative">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-2">
                                       <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Quantity</span>
                                       {mode === 'SALES' && <span className="text-[9px] font-black text-teal-400 uppercase tracking-tighter">Stock: {fd(item.stockLevel)}</span>}
                                    </div>
                                    <div className="flex items-center bg-white/5 p-1 rounded-2xl border-2 border-white/5 shadow-inner group-focus-within/qty:border-blue-500 transition-all">
                                       <button onClick={() => updateQty(item.tempId, -1)} className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><Minus size={20} strokeWidth={4}/></button>
                                       <input 
                                         type="number" 
                                         className="w-full bg-transparent text-center font-black text-2xl text-white outline-none tabular-nums"
                                         value={item.quantity}
                                         onChange={(e) => updateQtyDirect(item.tempId, e.target.value)}
                                       />
                                       <button onClick={() => updateQty(item.tempId, 1)} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all shadow-lg"><Plus size={20} strokeWidth={4}/></button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest px-2">Unit Rate (MRP)</span>
                                    <div className="relative group/mrp">
                                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 text-lg font-black transition-colors group-focus-within/mrp:text-blue-400">₹</span>
                                       <input 
                                          type="number" 
                                          className="w-full bg-white/5 border-2 border-white/5 rounded-[1.5rem] pl-12 pr-6 py-4.5 text-white font-black text-xl outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-inner"
                                          value={item.mrp}
                                          onChange={(e) => updatePriceInfo(item.tempId, 'mrp', e.target.value)}
                                       />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t-2 border-white/5 relative">
                                <div className="flex items-center gap-4 bg-white/[0.03] p-4 px-6 rounded-2xl border-2 border-white/5 shadow-inner">
                                   <div className="flex items-center gap-3">
                                      <Percent size={14} className="text-blue-500" strokeWidth={3} />
                                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mr-1">Discount Rules Applied</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <input 
                                         type="number" 
                                         className="w-16 bg-transparent text-white font-black text-right text-base outline-none focus:text-blue-400 transition-colors"
                                         value={item.discount}
                                         onChange={(e) => updatePriceInfo(item.tempId, 'discount', e.target.value)}
                                      />
                                      <span className="text-xs font-black text-white/20">%</span>
                                   </div>
                                </div>
                                <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="text-white/10 hover:text-rose-500 hover:bg-rose-500/10 p-4 rounded-2xl transition-all active:scale-90 group-hover/item:text-white/40"><Trash2 size={26} strokeWidth={2.5}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-12 border-t-4 border-slate-900 bg-black/40 relative z-20">
                    <div className="flex justify-between items-end mb-10">
                       <div className="flex flex-col">
                          <span className="text-white/40 font-black uppercase tracking-[0.4em] text-[11px] mb-2">Aggregate Settlement</span>
                          <div className="flex items-center gap-3 text-teal-400 bg-teal-400/5 px-4 py-1.5 rounded-full border border-teal-400/10 w-fit">
                             <Sparkles size={14} />
                             <span className="text-[10px] font-black uppercase tracking-widest">Validated Session Protocol</span>
                          </div>
                       </div>
                       <span className="text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={handleSubmit} 
                      disabled={cart.length === 0 || loading} 
                      className={`w-full py-8 rounded-[2.5rem] font-black text-white text-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all transform active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-6 uppercase tracking-[0.2em] ${accentColor} border-2 border-white/10 hover:shadow-none hover:brightness-110`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={32} /> : <>Commit Session <ArrowRight size={32} strokeWidth={4} /></>}
                    </button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default DailyTransactions;
