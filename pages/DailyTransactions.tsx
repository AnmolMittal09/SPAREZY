import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Customer, Brand } from '../types';
import { createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getCustomers } from '../services/masterService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  User as UserIcon,
  PackagePlus,
  ArrowLeft,
  X,
  AlertCircle,
  Zap,
  ArrowRight,
  ChevronRight,
  Filter,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  CreditCard,
  History,
  CheckCircle2
} from 'lucide-react';

interface Props {
  user: User;
  forcedMode?: 'SALES' | 'PURCHASE' | 'RETURN';
  onSearchToggle?: (isOpen: boolean) => void;
}

interface CartItem {
  tempId: string;
  partNumber: string;
  name?: string; 
  type: TransactionType;
  quantity: number;
  price: number;
  customerName: string;
  stockError?: boolean;
}

const DailyTransactions: React.FC<Props> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
  const [hideFilters, setHideFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInventory().then(setInventory);
    if (mode === 'SALES') {
      getCustomers().then(data => Array.isArray(data) && setSavedCustomers(data));
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowCustomerList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  useEffect(() => { if (forcedMode) setMode(forcedMode); }, [forcedMode]);

  useEffect(() => {
    if (onSearchToggle) onSearchToggle(showMobileSearch);
  }, [showMobileSearch, onSearchToggle]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       if (val.length > 1) setHideFilters(true);
       
       let filtered = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       );
       if (selectedBrand !== 'ALL') {
         filtered = filtered.filter(i => i.brand === selectedBrand);
       }
       setSuggestions(filtered.slice(0, 40));
    } else {
       setSuggestions([]);
       setHideFilters(false);
    }
  };

  const handleCustomerType = (val: string) => {
    setCustomerName(val);
    if (mode === 'SALES' && val.length > 0) {
      const lowerVal = val.toLowerCase();
      setCustomerSuggestions(savedCustomers.filter(c => 
        (c.name?.toLowerCase().includes(lowerVal)) || (c.phone?.includes(val))
      ).slice(0, 5));
      setShowCustomerList(true);
    } else setShowCustomerList(false);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) {
          updateQty(existing.tempId, 1);
          resetSearch();
          return;
      }
      if (mode === 'SALES' && item.quantity === 0) return alert("Item is completely out of stock!");

      const newItem: CartItem = {
          tempId: Math.random().toString(36).substring(7),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          price: item.price,
          customerName: customerName,
          stockError: false
      };
      setCart(prev => [...prev, newItem]);
      resetSearch();
  };

  const resetSearch = () => {
    setSearch('');
    setSuggestions([]);
    setShowMobileSearch(false);
    setHideFilters(false);
  };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = item.quantity + delta;
              if (newQty < 1) newQty = 1;
              if (mode === 'SALES') {
                  const stockItem = inventory.find(i => i.partNumber === item.partNumber);
                  if (stockItem && newQty > stockItem.quantity) {
                    alert(`Only ${stockItem.quantity} units available.`);
                    newQty = stockItem.quantity;
                  }
              }
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.tempId !== id));
  };

  const handleSubmit = async () => {
      if (cart.length === 0) return;
      if (mode === 'SALES' && !customerName.trim()) return alert("Please specify a customer name.");

      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Bulk Supplier' : 'Direct Return'),
          createdByRole: user.role
      }));
      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);
      
      if (res.success) {
          alert(user.role === Role.MANAGER ? "Batch sent to Owner for approval." : "Transaction logged successfully.");
          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else alert("Processing Error: " + res.message);
  };

  const handleMobileScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 80 && !hideFilters && suggestions.length > 0) {
      setHideFilters(true);
    } else if (scrollTop < 20 && hideFilters && search.length === 0) {
      setHideFilters(false);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600 shadow-rose-200' : mode === 'PURCHASE' ? 'bg-slate-900 shadow-slate-200' : 'bg-brand-600 shadow-brand-200';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in relative overflow-hidden">
       
       {/* MOBILE SEARCH OVERLAY */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-slide-up h-[100dvh] w-screen overflow-hidden">
            <div className="flex-none h-24 flex items-end px-6 pb-4 gap-4 bg-white border-b border-slate-100 shadow-sm">
               <button onClick={() => { setShowMobileSearch(false); setHideFilters(false); }} className="p-3.5 text-slate-900 bg-slate-100 rounded-2xl active:scale-90 transition-all">
                  <X size={24} strokeWidth={3} />
               </button>
               <div className="flex-1">
                  <h3 className="font-black text-2xl text-slate-900 tracking-tight leading-none">Select Part</h3>
                  <p className="text-[11px] font-black text-brand-600 uppercase tracking-[0.25em] mt-2">Master Catalog Lookup</p>
               </div>
            </div>
            
            <div className={`flex-none bg-white transition-all duration-500 ease-in-out overflow-hidden ${hideFilters ? 'max-h-[96px]' : 'max-h-[190px]'}`}>
                <div className="p-6 space-y-5">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                        <input 
                            autoFocus
                            type="text" 
                            autoComplete="off"
                            className="w-full bg-slate-100 p-5 pl-14 rounded-2xl border-none text-[18px] font-bold shadow-inner outline-none ring-2 ring-transparent focus:ring-brand-500/10 focus:bg-white transition-all placeholder:text-slate-300"
                            placeholder="Type SKU or part name..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                        />
                        {search && (
                          <button onClick={() => handleSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 bg-slate-200/40 p-2 rounded-xl active:scale-90 transition-all">
                            <X size={18} strokeWidth={3} />
                          </button>
                        )}
                    </div>
                    
                    {!hideFilters && (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 animate-fade-in">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                              <button
                                  key={b}
                                  onClick={() => { setSelectedBrand(b); handleSearch(search); }}
                                  className={`px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all active:scale-95 ${selectedBrand === b ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}
                              >
                                  {b}
                              </button>
                          ))}
                      </div>
                    )}
                </div>
            </div>

            <div 
              ref={scrollRef}
              onScroll={handleMobileScroll}
              className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar bg-[#F8FAFC] pb-24"
            >
                {suggestions.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="w-full bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-premium flex justify-between items-center text-left active:scale-[0.98] transition-all group"
                    >
                        <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-2.5 mb-2.5">
                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                    {item.brand.substring(0,3)}
                                </span>
                                <div className="font-black text-slate-900 text-xl tracking-tight truncate group-active:text-brand-600 transition-colors">{item.partNumber}</div>
                            </div>
                            <div className="text-[14px] text-slate-400 font-bold truncate mb-4">{item.name}</div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest">
                                   <div className={`w-2 h-2 rounded-full ${item.quantity > 0 ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                   <span className={item.quantity > 0 ? 'text-slate-600' : 'text-rose-500'}>{item.quantity} In Stock</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-4">
                            <div className="font-black text-slate-900 text-2xl tracking-tighter">₹{item.price.toLocaleString()}</div>
                            <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] shadow-xl shadow-slate-100 flex items-center justify-center group-active:scale-90 transition-all">
                                <Plus size={28} strokeWidth={3} />
                            </div>
                        </div>
                    </button>
                ))}
                
                {search.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                      <div className="w-28 h-28 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-soft">
                        <LayoutGrid size={56} className="opacity-10" />
                      </div>
                      <p className="font-black text-[13px] uppercase tracking-[0.4em] text-slate-400">Inventory Feed</p>
                      <p className="text-[11px] font-bold text-slate-300 mt-3 text-center px-10">Scan SKU or type description to begin selection.</p>
                   </div>
                )}

                {search.length > 1 && suggestions.length === 0 && (
                    <div className="text-center py-24">
                        <AlertCircle className="mx-auto text-slate-200 mb-8" size={72} />
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">SKU Not Found</p>
                        <button onClick={() => handleSearch('')} className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Reset Search</button>
                    </div>
                )}
            </div>
         </div>
       )}

       {/* DESKTOP VIEW */}
       <div className="hidden lg:grid grid-cols-12 gap-8 h-full p-1">
           <div className="col-span-8 bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                   <div className="relative">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                       <input 
                         type="text" 
                         className="w-full pl-16 pr-6 py-5.5 bg-white border-2 border-transparent rounded-[2rem] text-xl font-bold placeholder:text-slate-300 focus:border-brand-500/10 focus:ring-[12px] focus:ring-brand-500/5 shadow-inner outline-none transition-all"
                         placeholder="Type Part Number or Model..."
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                         autoFocus
                       />
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50/20">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-5">
                         {suggestions.map(item => (
                            <button 
                              key={item.id}
                              onClick={() => addToCart(item)}
                              className="group text-left p-7 rounded-[2.5rem] border-2 border-white bg-white hover:border-brand-200 hover:shadow-2xl transition-all active:scale-[0.98]"
                            >
                               <div className="flex justify-between items-start mb-4">
                                   <div className="flex items-center gap-2">
                                      <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.substring(0,3)}</span>
                                      <span className="font-black text-xl text-slate-900 group-hover:text-brand-600 transition-colors">{item.partNumber}</span>
                                   </div>
                                   <span className={`text-[10px] px-2.5 py-1 rounded-xl font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                                       {item.quantity} UNIT{item.quantity !== 1 ? 'S' : ''}
                                   </span>
                               </div>
                               <div className="text-[15px] text-slate-500 font-medium truncate mb-5">{item.name}</div>
                               <div className="flex items-end justify-between">
                                  <div className="font-black text-2xl text-slate-900">₹{item.price.toLocaleString()}</div>
                                  <div className="bg-slate-50 p-2.5 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-all"><Plus size={20} strokeWidth={3} /></div>
                               </div>
                            </button>
                         ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-300">
                          <PackagePlus size={96} className="mb-8 opacity-10" />
                          <p className="font-black text-slate-400 uppercase tracking-[0.4em] text-xs">Ready for entry</p>
                      </div>
                  )}
               </div>
           </div>

           <div className="col-span-4 bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-100"><ShoppingCart size={22} /></div>
                        <h2 className="font-black text-2xl text-slate-900 tracking-tight">Checkout</h2>
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"><Trash2 size={18}/></button>
                    )}
                </div>
                
                <div className="p-8 pb-5 space-y-5" ref={wrapperRef}>
                    <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Billing To</span>
                           <UserIcon size={12} className="text-slate-300" />
                        </div>
                        <div className="relative group">
                            <input 
                               type="text" 
                               className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-[16px] font-bold outline-none focus:ring-[10px] focus:ring-brand-500/5 focus:bg-white transition-all shadow-inner"
                               placeholder="Customer name or Phone..."
                               value={customerName}
                               onChange={e => handleCustomerType(e.target.value)}
                            />
                            {showCustomerList && customerSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-100 rounded-3xl shadow-premium mt-3 overflow-hidden animate-slide-up">
                                 {customerSuggestions.map(c => (
                                    <button
                                       key={c.id}
                                       onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                       className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors"
                                    >
                                       <div>
                                          <span className="font-black text-slate-800 text-[15px]">{c.name}</span>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{c.type}</p>
                                       </div>
                                       <span className="text-xs text-slate-500 font-black bg-slate-50 px-3 py-1 rounded-xl">{c.phone}</span>
                                    </button>
                                 ))}
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-6 rounded-[2rem] border border-slate-100 bg-slate-50/40 flex flex-col gap-5 group hover:bg-white hover:shadow-xl hover:border-brand-100 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4">
                                    <div className="font-black text-slate-900 text-lg tracking-tight truncate">{item.partNumber}</div>
                                    <div className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest line-clamp-1">{item.name}</div>
                                </div>
                                <div className="font-black text-slate-900 text-xl tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100/50">
                                <button onClick={() => removeItem(item.tempId)} className="text-slate-300 hover:text-rose-500 p-2.5 rounded-xl hover:bg-rose-50 transition-all active:scale-90"><X size={20}/></button>
                                <div className="flex items-center gap-5 bg-white px-3 py-2 rounded-2xl shadow-soft border border-slate-100">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 active:scale-90 transition-all"><Minus size={18} strokeWidth={3}/></button>
                                    <span className="font-black w-8 text-center text-lg text-slate-900">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-slate-200"><Plus size={18} strokeWidth={3}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-slate-200 py-10 opacity-40">
                          <ShoppingCart size={64} className="mb-4" />
                          <p className="font-black text-[10px] uppercase tracking-widest">Cart Pending</p>
                       </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 bg-white">
                    <div className="flex justify-between items-center mb-8 px-1">
                        <span className="text-slate-400 font-black uppercase tracking-[0.25em] text-[12px]">Bill Amount</span>
                        <span className="text-4xl font-black text-slate-900 tracking-tighter">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={handleSubmit} 
                       disabled={loading || cart.length === 0} 
                       className={`w-full py-6 rounded-[2.5rem] font-black text-white text-[18px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-4 uppercase tracking-[0.1em] ${accentColor}`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={28} /> : (
                         <><span className="hidden lg:inline">{mode === 'PURCHASE' ? 'Verify' : 'Finalize'}</span> <ArrowRight size={24} /></>
                       )}
                    </button>
                </div>
           </div>
       </div>

       {/* MOBILE POINT OF SALE UI */}
       <div className="lg:hidden flex flex-col h-full bg-[#F8FAFC]">
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-64 no-scrollbar">
              
              {/* Customer Section */}
              {mode === 'SALES' && (
                <div className="bg-white p-7 rounded-[3rem] shadow-soft border border-slate-100 mb-8 relative" ref={wrapperRef}>
                    <div className="flex items-center justify-between mb-5 px-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identity</span>
                        {customerName && <button onClick={() => setCustomerName('')} className="p-2 bg-rose-50 text-rose-500 rounded-xl active:scale-90 transition-all"><X size={14} strokeWidth={3} /></button>}
                    </div>
                    <div className="flex items-center gap-5 bg-slate-100 p-5 rounded-2xl focus-within:bg-white focus-within:ring-[10px] focus-within:ring-brand-500/5 transition-all shadow-inner border-2 border-transparent focus-within:border-brand-500/10">
                        <UserIcon className="text-slate-300" size={22} />
                        <input 
                            type="text"
                            autoComplete="off"
                            className="flex-1 bg-transparent outline-none font-black text-slate-900 placeholder:text-slate-300 text-xl"
                            placeholder="Customer Name..."
                            value={customerName}
                            onChange={e => handleCustomerType(e.target.value)}
                        />
                    </div>
                    {showCustomerList && customerSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[60] bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl mt-4 overflow-hidden animate-slide-up mx-2 p-2">
                            {customerSuggestions.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                    className="w-full text-left p-5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center active:bg-slate-100 rounded-2xl transition-colors"
                                >
                                    <div>
                                       <span className="font-black text-slate-900 text-lg block leading-none mb-1">{c.name}</span>
                                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.phone}</span>
                                    </div>
                                    <div className="bg-brand-50 text-brand-600 p-2 rounded-xl"><Plus size={18} /></div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              )}

              {/* Cart Section */}
              <div className="space-y-5">
                  <div className="flex items-center justify-between px-4 mb-4">
                     <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">Items ({cart.length})</h4>
                     {cart.length > 0 && <button onClick={() => setCart([])} className="p-2 bg-rose-50 text-rose-500 rounded-xl"><Trash2 size={16} /></button>}
                  </div>

                  {cart.length === 0 ? (
                      <div className="bg-white/40 border-2 border-dashed border-slate-200 rounded-[3rem] p-20 text-center shadow-inner">
                         <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-premium">
                            <ShoppingCart size={40} className="text-slate-200 opacity-20" />
                         </div>
                         <p className="font-black text-slate-400 uppercase tracking-[0.3em] text-[11px]">Ready for selection</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className="bg-white p-7 rounded-[3rem] shadow-premium border border-slate-50 flex flex-col gap-7 animate-fade-in relative overflow-hidden active:scale-[0.99] transition-all">
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-6">
                                  <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none mb-2">{item.partNumber}</div>
                                  <div className="text-[14px] text-slate-400 font-bold truncate leading-none uppercase tracking-wide">{item.name}</div>
                               </div>
                               <div className="text-right">
                                  <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none mb-1.5">₹{(item.price * item.quantity).toLocaleString()}</div>
                                  <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Rate ₹{item.price}</div>
                               </div>
                           </div>
                           <div className="flex items-center justify-between border-t border-slate-100/50 pt-7">
                               <button onClick={() => removeItem(item.tempId)} className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-500 rounded-[1.5rem] active:scale-90 transition-all shadow-sm"><Trash2 size={24} /></button>
                               <div className="flex items-center gap-8 bg-slate-100 p-2 rounded-[2rem] shadow-inner border border-slate-50">
                                   <button onClick={() => updateQty(item.tempId, -1)} className="w-12 h-12 bg-white shadow-soft rounded-[1.2rem] flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Minus size={22} strokeWidth={3}/></button>
                                   <span className="w-10 text-center font-black text-3xl text-slate-900 tracking-tighter">{item.quantity}</span>
                                   <button onClick={() => updateQty(item.tempId, 1)} className={`w-12 h-12 ${accentColor} text-white shadow-xl rounded-[1.2rem] flex items-center justify-center active:scale-90 transition-all`}><Plus size={22} strokeWidth={3}/></button>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          {/* CHECKOUT BAR */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-3xl border-t border-slate-100 p-7 shadow-[0_-25px_60px_rgba(0,0,0,0.12)] z-[80] pb-10">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-5 mb-8 transition-all active:scale-95 text-[17px] uppercase tracking-[0.2em] shadow-2xl"
              >
                  <PackagePlus size={26} /> Add Parts
              </button>

              <div className="flex items-center gap-6">
                  <div className="flex-1 min-w-0">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 px-1">Grand Total</p>
                     <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none truncate">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={handleSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.4] text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-20 text-[18px] ${accentColor}`}
                   >
                     {loading ? <Loader2 className="animate-spin" size={32} /> : (
                        <><span className="uppercase text-sm tracking-[0.15em] font-black">{mode === 'PURCHASE' ? 'Inbound' : 'Checkout'}</span> <ArrowRight size={26} /></>
                     )}
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};

export default DailyTransactions;