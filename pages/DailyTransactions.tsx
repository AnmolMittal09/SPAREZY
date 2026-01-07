
import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Customer, Brand, TransactionStatus } from '../types';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { getCustomers } from '../services/masterService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  PackagePlus,
  ArrowLeft,
  ArrowRight,
  Percent,
  PlusSquare,
  Sparkles,
  Banknote,
  Wallet,
  CheckCircle2,
  CreditCard,
  CircleSlash,
  ChevronDown,
  X,
  Package,
  Check
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const DailyTransactions: React.FC<any> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [pendingSalesMap, setPendingSalesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAddingNewSku, setIsAddingNewSku] = useState(false);
  const [newSkuForm, setNewSkuForm] = useState({ partNumber: '', name: '', mrp: '', brand: Brand.HYUNDAI });

  const loadBaseData = async () => {
    const [inv] = await Promise.all([fetchInventory()]);
    setInventory(inv);
    const pendingSales = await fetchTransactions(TransactionStatus.PENDING, TransactionType.SALE);
    const pMap: Record<string, number> = {};
    pendingSales.forEach(tx => { const pn = tx.partNumber.toLowerCase(); pMap[pn] = (pMap[pn] || 0) + tx.quantity; });
    setPendingSalesMap(pMap);
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
      if (existing) { updateQty(existing.tempId, 1); resetSearch(); return; }
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
          brand: item.brand
      };
      setCart(prev => [...prev, newItem]); 
      resetSearch();
  };

  const resetSearch = () => { setSearch(''); setSuggestions([]); setShowMobileSearch(false); };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => item.tempId === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    const payload = cart.map(item => ({
       partNumber: item.partNumber,
       type: mode as TransactionType,
       quantity: item.quantity,
       price: item.price,
       paidAmount: mode === 'SALES' ? 0 : (item.price * item.quantity), // Default 0 for sales, full for purchases
       customerName: customerName || 'Walk-in',
       createdByRole: user.role,
       createdByName: user.name
    }));

    const res = await createBulkTransactions(payload);
    setLoading(false);
    if (res.success) {
      setCart([]);
      setCustomerName('');
      setShowMobileCart(false);
      alert("Session committed successfully.");
    } else {
      alert("Failed to commit: " + res.message);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-700' : mode === 'PURCHASE' ? 'bg-slate-950' : 'bg-blue-700';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in overflow-hidden relative">
       
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
                      className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-2xl font-black text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase text-[15px]"
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
                        <button key={b} onClick={() => setSelectedBrand(b)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedBrand === b ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>{b}</button>
                      ))}
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-3 pb-24 no-scrollbar">
                      {suggestions.length > 0 ? (
                        suggestions.map(item => (
                          <button key={item.id} onClick={() => addToCart(item)} className="w-full p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all group">
                             <div className="flex-1 min-w-0 pr-4">
                                <div className="font-black text-slate-900 text-lg uppercase tracking-tight mb-1">{item.partNumber}</div>
                                <div className="text-[11px] text-slate-400 font-bold uppercase truncate">{item.name}</div>
                             </div>
                             <div className="text-right flex flex-col items-end gap-2">
                                <div className="font-black text-slate-900">₹{item.price.toLocaleString()}</div>
                                <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg group-active:bg-blue-700"><Plus size={18} strokeWidth={3}/></div>
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

          {/* Mobile Main Body (Cart Summary or Empty State) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                   <PackagePlus size={80} className="mb-6 opacity-10" />
                   <p className="font-black text-[11px] uppercase tracking-[0.4em] text-center">Manual Protocol Idle<br/><span className="text-slate-400 opacity-60">Scan parts to begin</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Draft</span>
                      <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Flush All</button>
                   </div>
                   {cart.map(item => (
                      <div key={item.tempId} className="p-5 bg-white rounded-[2rem] border-2 border-slate-100 shadow-soft flex flex-col gap-4">
                         <div className="flex justify-between items-start">
                            <div className="min-w-0 pr-4">
                               <div className="flex items-center gap-2 mb-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.slice(0,3)}</span>
                                  <div className="font-black text-slate-950 text-[17px] tracking-tight uppercase truncate">{item.partNumber}</div>
                               </div>
                               <div className="text-[11px] text-slate-400 font-bold uppercase truncate">{item.name}</div>
                            </div>
                            <div className="text-right flex-none">
                               <p className="text-[18px] font-black text-slate-900 tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                               <button onClick={() => updateQty(item.tempId, -1)} className="w-9 h-9 bg-white text-slate-400 rounded-lg flex items-center justify-center shadow-sm active:scale-90"><Minus size={16} strokeWidth={3}/></button>
                               <span className="w-10 text-center font-black text-slate-900 tabular-nums">{fd(item.quantity)}</span>
                               <button onClick={() => updateQty(item.tempId, 1)} className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-md active:scale-90"><Plus size={16} strokeWidth={3}/></button>
                            </div>
                            <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="p-3 text-slate-300 hover:text-rose-500 active:scale-90"><Trash2 size={20}/></button>
                         </div>
                      </div>
                   ))}
                </div>
              )}
          </div>

          {/* Floating Cart & Submit (Mobile) */}
          {cart.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-[90] pb-safe animate-slide-up">
               <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl flex flex-col gap-6">
                  <div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 block ml-1">Entity Reference</span>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[15px] font-black outline-none focus:border-blue-500 transition-all placeholder:text-white/20 uppercase"
                      placeholder="Receiver Name..."
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                      <div className="flex flex-col">
                         <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">AGGREGATE VALUE</p>
                         <p className="text-3xl font-black tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all ${accentColor} border border-white/10 disabled:opacity-50`}
                      >
                         {loading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} strokeWidth={3}/> COMMIT</>}
                      </button>
                  </div>
               </div>
            </div>
          )}
       </div>

       {/* DESKTOP UI */}
       <div className="hidden lg:grid grid-cols-12 gap-8 h-full p-2">
           <div className="col-span-7 bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 flex flex-col overflow-hidden">
               <div className="p-8 border-b-2 border-slate-100 bg-slate-50 space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex bg-slate-200 p-1.5 rounded-2xl border-2 border-slate-300 w-fit">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                             <button key={b} onClick={() => setSelectedBrand(b)} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedBrand === b ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-950'}`}>{b}</button>
                          ))}
                      </div>
                      {mode === 'PURCHASE' && <div className="bg-slate-950 text-white px-5 py-3 rounded-xl flex items-center gap-3 font-black text-[11px] uppercase tracking-[0.15em]"><Percent size={14} /> Auto-Rules Active</div>}
                   </div>
                   <div className="relative">
                       <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900" size={32} strokeWidth={3} />
                       <input type="text" className="w-full pl-18 pr-6 py-6 bg-white border-2 border-slate-200 rounded-[2.5rem] text-3xl font-black text-slate-950 placeholder:text-slate-300 focus:border-slate-950 outline-none transition-all uppercase tracking-tighter" placeholder="SCAN PART IDENTIFIER..." value={search} onChange={e => handleSearch(e.target.value)}/>
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50/20">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-5">
                         {suggestions.map(item => (
                            <button key={item.id} onClick={() => addToCart(item)} className="group/btn text-left p-6 rounded-[2.5rem] border-2 border-slate-200 bg-white hover:border-slate-950 hover:shadow-elevated transition-all active:scale-[0.98]">
                                <div className="flex justify-between items-start mb-3"><span className="font-black text-xl text-slate-950 tracking-tighter uppercase leading-none">{item.partNumber}</span><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 ${item.quantity > 0 ? 'bg-teal-700 text-white border-teal-800' : 'bg-rose-700 text-white border-rose-800'}`}>{item.quantity > 0 ? 'AVL' : 'OUT'}</span></div>
                                <div className="text-[13px] text-slate-700 font-extrabold truncate mb-5 uppercase tracking-tight">{item.name}</div>
                                <div className="flex justify-between items-center"><div className="font-black text-2xl text-slate-950 tracking-tighter tabular-nums">₹{item.price.toLocaleString()}</div><div className="p-3 bg-slate-950 text-white rounded-2xl shadow-lg opacity-0 group-hover/btn:opacity-100 transition-all"><Plus size={18} strokeWidth={4}/></div></div>
                            </button>
                         ))}
                      </div>
                  ) : <div className="flex flex-col items-center justify-center h-full text-slate-300"><PackagePlus size={80} strokeWidth={2.5} className="mb-6 opacity-20" /><p className="font-black text-slate-400 uppercase tracking-[0.4em] text-sm">Protocol Scanner Idle</p></div>}
               </div>
           </div>

           <div className="col-span-5 bg-slate-950 rounded-[3rem] shadow-elevated flex flex-col overflow-hidden text-white border-2 border-slate-900">
                <div className="p-10 border-b-2 border-white/5 flex justify-between items-center">
                    <h2 className="font-black text-2xl tracking-tighter flex items-center gap-4 uppercase"><ShoppingCart size={28} strokeWidth={3} className="text-blue-500" /> Current Cart</h2>
                    <span className="bg-white text-slate-950 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest">{fd(cart.length)} Assets</span>
                </div>

                <div className="p-10 space-y-8">
                    <div>
                        <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.25em] mb-4 block ml-1">Entity Reference</span>
                        <input type="text" className="w-full px-8 py-5 bg-white/5 border-2 border-white/10 rounded-3xl text-xl font-black text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-white/20 uppercase tracking-tight" placeholder="Verified Receiver Name" value={customerName} onChange={e => setCustomerName(e.target.value)}/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-6 rounded-[2.5rem] border-2 border-white/5 bg-white/[0.03] flex flex-col gap-5 animate-fade-in hover:bg-white/10 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4 flex-1">
                                    <div className="flex items-center gap-2 mb-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded text-white tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.slice(0,3)}</span><div className="font-black text-white text-xl tracking-tight uppercase leading-none">{item.partNumber}</div></div>
                                    <div className="text-[12px] text-white/60 font-bold uppercase truncate tracking-tight">{item.name}</div>
                                </div>
                                <div className="text-right"><div className="font-black text-white text-2xl tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</div></div>
                            </div>
                            <div className="flex items-center gap-4 pt-5 border-t-2 border-white/5">
                                <div className="flex items-center bg-white/10 p-1.5 rounded-2xl border-2 border-white/5"><button onClick={() => updateQty(item.tempId, -1)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><Minus size={18} strokeWidth={4}/></button><span className="w-14 text-center font-black text-xl text-white tabular-nums">{fd(item.quantity)}</span><button onClick={() => updateQty(item.tempId, 1)} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all"><Plus size={18} strokeWidth={4}/></button></div>
                                <div className="flex-1 flex items-center gap-3 bg-white/10 p-3 px-5 rounded-2xl border-2 border-white/5"><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Rate</span><input type="number" className="w-full bg-transparent text-white font-black text-right text-lg outline-none" value={item.price} readOnly/></div>
                                <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="text-white/20 hover:text-rose-500 p-3 rounded-2xl transition-all"><Trash2 size={24} strokeWidth={2.5}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-10 border-t-4 border-slate-900 bg-black/40">
                    <div className="flex justify-between items-end mb-8"><div className="flex flex-col"><span className="text-white/40 font-black uppercase tracking-[0.3em] text-[11px]">Aggregate Net Total</span><p className="text-[11px] font-bold text-teal-400 uppercase tracking-widest mt-1">Validated Transaction Value</p></div><span className="text-5xl font-black text-white tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</span></div>
                    <button onClick={handleSubmit} disabled={cart.length === 0 || loading} className={`w-full py-7 rounded-[2rem] font-black text-white text-xl shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-5 uppercase tracking-widest ${accentColor} border-2 border-white/10`}>{loading ? <Loader2 className="animate-spin" size={28} /> : <>Commit Session <ArrowRight size={28} strokeWidth={4} /></>}</button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default DailyTransactions;
