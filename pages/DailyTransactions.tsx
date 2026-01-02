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
  CreditCard
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
       setSuggestions(filtered.slice(0, 30));
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
      if (mode === 'SALES' && item.quantity === 0) return alert("Item out of stock!");

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
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
                  if (stockItem && newQty > stockItem.quantity) newQty = stockItem.quantity;
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
      if (mode === 'SALES' && !customerName.trim()) return alert("Customer Name is required.");

      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Bulk Supplier' : 'Walk-in'),
          createdByRole: user.role
      }));
      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);
      
      if (res.success) {
          alert(user.role === Role.MANAGER ? "Sent for approval." : "Transaction successful.");
          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else alert("Error: " + res.message);
  };

  const handleMobileScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 50 && !hideFilters && suggestions.length > 0) {
      setHideFilters(true);
    } else if (scrollTop < 10 && hideFilters && search.length === 0) {
      setHideFilters(false);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in relative overflow-hidden">
       
       {/* MOBILE SEARCH MODAL - Immersive Full Screen */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-slide-up h-[100dvh] w-screen overflow-hidden">
            <div className="flex-none h-24 flex items-end px-5 pb-4 gap-4 bg-white border-b border-slate-100 shadow-sm">
               <button onClick={() => { setShowMobileSearch(false); setHideFilters(false); }} className="p-3 text-slate-900 bg-slate-100 rounded-2xl active:scale-90 transition-all">
                  <ArrowLeft size={24} strokeWidth={2.5} />
               </button>
               <div className="flex-1">
                  <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none">Find Spare Part</h3>
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mt-1.5">Master Catalog Lookup</p>
               </div>
               <button 
                  onClick={() => setHideFilters(!hideFilters)} 
                  className={`p-3 rounded-2xl transition-all ${hideFilters ? 'text-brand-600 bg-brand-50' : 'text-slate-400 bg-slate-50'}`}
               >
                  <Filter size={20} />
               </button>
            </div>
            
            <div className={`flex-none bg-white transition-all duration-300 ease-in-out overflow-hidden ${hideFilters ? 'max-h-[84px]' : 'max-h-[160px]'}`}>
                <div className="p-5 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={22} />
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full bg-slate-50 p-4.5 pl-12 rounded-2xl border-none text-[17px] font-bold shadow-inner outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
                            placeholder="Type part number..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                        />
                        {search && (
                          <button onClick={() => handleSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 bg-slate-200/50 p-1.5 rounded-full active:scale-90 transition-all">
                            <X size={18} />
                          </button>
                        )}
                    </div>
                    
                    {!hideFilters && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 animate-fade-in">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                              <button
                                  key={b}
                                  onClick={() => { setSelectedBrand(b); handleSearch(search); }}
                                  className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all active:scale-95 ${selectedBrand === b ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}
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
              className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-[#F8FAFC]"
            >
                {suggestions.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="w-full bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-premium flex justify-between items-center text-left active:scale-[0.97] transition-all group"
                    >
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${item.quantity > 0 ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                    {item.brand.substring(0,3)}
                                </span>
                                <div className="font-black text-slate-900 text-lg tracking-tight truncate group-active:text-brand-600 transition-colors">{item.partNumber}</div>
                            </div>
                            <div className="text-[13px] text-slate-400 font-bold truncate mb-3 pl-4">{item.name}</div>
                            <div className="flex items-center gap-3 pl-4">
                                <div className="text-[10px] font-black uppercase text-slate-300 tracking-widest">
                                   Stock: <span className={item.quantity > 0 ? 'text-slate-600' : 'text-rose-500'}>{item.quantity} units</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-3">
                            <div className="font-black text-slate-900 text-xl tracking-tight">₹{item.price.toLocaleString()}</div>
                            <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl shadow-lg shadow-brand-100 flex items-center justify-center group-active:scale-90 transition-all">
                                <Plus size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </button>
                ))}
                
                {search.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-soft animate-pulse">
                        <LayoutGrid size={48} className="opacity-20" />
                      </div>
                      <p className="font-black text-[12px] uppercase tracking-[0.4em] text-slate-400">Inventory Explorer</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-2">Start typing to see matching items</p>
                   </div>
                )}

                {search.length > 1 && suggestions.length === 0 && (
                    <div className="text-center py-24">
                        <AlertCircle className="mx-auto text-slate-200 mb-6" size={64} />
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">No Matching Inventory</p>
                        <button onClick={() => handleSearch('')} className="mt-6 text-brand-600 font-black text-xs uppercase tracking-widest">Clear Search</button>
                    </div>
                )}
            </div>
         </div>
       )}

       {/* DESKTOP UI (Shared) */}
       <div className="hidden lg:grid grid-cols-12 gap-8 h-full">
           <div className="col-span-8 bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                   <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
                       <input 
                         type="text" 
                         className="w-full pl-14 pr-4 py-5 bg-white border border-slate-100 rounded-[2rem] text-xl font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-brand-500/10 shadow-inner outline-none transition-all"
                         placeholder="Enter Part Number to Add..."
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                         autoFocus
                       />
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                         {suggestions.map(item => (
                            <button 
                              key={item.id}
                              onClick={() => addToCart(item)}
                              className="group text-left p-6 rounded-[2rem] border-2 border-slate-50 bg-white hover:border-brand-200 hover:shadow-xl transition-all active:scale-95"
                            >
                               <div className="flex justify-between items-start mb-3">
                                   <span className="font-black text-lg text-slate-900 group-hover:text-brand-600 transition-colors">{item.partNumber}</span>
                                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                                       {item.quantity} Stock
                                   </span>
                               </div>
                               <div className="text-[14px] text-slate-500 font-medium truncate mb-4">{item.name}</div>
                               <div className="font-black text-xl text-slate-900">₹{item.price.toLocaleString()}</div>
                            </button>
                         ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-300">
                          <PackagePlus size={80} className="mb-6 opacity-10" />
                          <p className="font-bold text-slate-400 uppercase tracking-[0.2em] text-xs">Scan or Search for Parts</p>
                      </div>
                  )}
               </div>
           </div>

           <div className="col-span-4 bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
                        <ShoppingCart size={22} className="text-brand-600" /> Cart
                    </h2>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-xs font-black text-rose-600 uppercase tracking-widest hover:underline">Clear</button>
                    )}
                </div>
                
                <div className="p-8 pb-4 space-y-4" ref={wrapperRef}>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block ml-1">Bill To Customer</span>
                        <div className="relative group">
                            <input 
                               type="text" 
                               className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-brand-500/10 transition-all shadow-inner"
                               placeholder="Customer Name"
                               value={customerName}
                               onChange={e => handleCustomerType(e.target.value)}
                            />
                            {showCustomerList && customerSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-100 rounded-2xl shadow-premium mt-2 overflow-hidden animate-slide-up">
                                 {customerSuggestions.map(c => (
                                    <button
                                       key={c.id}
                                       onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                       className="w-full text-left px-5 py-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors"
                                    >
                                       <span className="font-bold text-slate-800">{c.name}</span>
                                       <span className="text-xs text-slate-400 font-bold">{c.phone}</span>
                                    </button>
                                 ))}
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/50 flex flex-col gap-4 group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-900 text-[15px]">{item.partNumber}</div>
                                    <div className="text-xs text-slate-500 font-medium line-clamp-1">{item.name}</div>
                                </div>
                                <div className="font-black text-slate-900 text-[15px]">₹{(item.price * item.quantity).toLocaleString()}</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={() => removeItem(item.tempId)} className="text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-white transition-all"><Trash2 size={18}/></button>
                                <div className="flex items-center gap-3 bg-white px-2 py-1.5 rounded-xl shadow-soft border border-slate-100">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 active:scale-90 transition-all"><Minus size={18}/></button>
                                    <span className="font-black w-6 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center active:scale-90 transition-all"><Plus size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 border-t border-slate-50">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Total Due</span>
                        <span className="text-3xl font-black text-slate-900 tracking-tight">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={handleSubmit} 
                       disabled={loading || cart.length === 0} 
                       className={`w-full py-5 rounded-[1.5rem] font-black text-white text-[17px] shadow-xl transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-3 ${accentColor}`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={24} /> : (
                         <>Checkout <ArrowRight size={22} /></>
                       )}
                    </button>
                </div>
           </div>
       </div>

       {/* MOBILE POINT OF SALE MAIN SCREEN */}
       <div className="lg:hidden flex flex-col h-full bg-[#F8FAFC]">
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-52 no-scrollbar">
              
              {/* Customer Selection Mobile */}
              {mode === 'SALES' && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 mb-6 relative" ref={wrapperRef}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Selection</span>
                        {customerName && <button onClick={() => setCustomerName('')} className="text-[9px] font-black text-rose-500 uppercase px-2 py-1 bg-rose-50 rounded-lg">Reset</button>}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all shadow-inner">
                        <UserIcon className="text-slate-300" size={22} />
                        <input 
                            type="text"
                            className="flex-1 bg-transparent outline-none font-bold text-slate-900 placeholder:text-slate-300 text-lg"
                            placeholder="Name or Phone..."
                            value={customerName}
                            onChange={e => handleCustomerType(e.target.value)}
                        />
                    </div>
                    {showCustomerList && customerSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[60] bg-white border border-slate-100 rounded-3xl shadow-premium mt-3 overflow-hidden animate-slide-up mx-2">
                            {customerSuggestions.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                    className="w-full text-left px-6 py-4.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center active:bg-slate-100 transition-colors"
                                >
                                    <div>
                                       <span className="font-bold text-slate-800 text-base block">{c.name}</span>
                                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.type}</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded-lg">{c.phone}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              )}

              {/* Shopping Cart List Mobile */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between px-3 mb-3">
                     <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Cart ({cart.length})</h4>
                     {cart.length > 0 && <button onClick={() => setCart([])} className="text-[11px] font-black text-rose-500 uppercase tracking-widest">Empty</button>}
                  </div>

                  {cart.length === 0 ? (
                      <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center shadow-inner">
                         <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-soft">
                            <ShoppingCart size={32} className="text-slate-200" />
                         </div>
                         <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-[11px]">Your cart is empty</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className="bg-white p-6 rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col gap-6 animate-fade-in relative overflow-hidden group">
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-4">
                                  <div className="font-black text-slate-900 text-xl tracking-tight leading-none mb-1.5">{item.partNumber}</div>
                                  <div className="text-[13px] text-slate-400 font-bold truncate">{item.name}</div>
                               </div>
                               <div className="text-right">
                                  <div className="font-black text-slate-900 text-xl">₹{(item.price * item.quantity).toLocaleString()}</div>
                                  <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-1">MRP ₹{item.price}</div>
                               </div>
                           </div>
                           <div className="flex items-center justify-between border-t border-slate-50 pt-5">
                               <button onClick={() => removeItem(item.tempId)} className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl active:scale-90 transition-all"><Trash2 size={22} /></button>
                               <div className="flex items-center gap-6 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                                   <button onClick={() => updateQty(item.tempId, -1)} className="w-11 h-11 bg-white shadow-soft rounded-xl flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Minus size={20} strokeWidth={3}/></button>
                                   <span className="w-8 text-center font-black text-2xl text-slate-900">{item.quantity}</span>
                                   <button onClick={() => updateQty(item.tempId, 1)} className={`w-11 h-11 ${accentColor} text-white shadow-lg rounded-xl flex items-center justify-center active:scale-90 transition-all`}><Plus size={20} strokeWidth={3}/></button>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          {/* Sticky Checkout Bar Mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 p-6 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-[80] pb-safe">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 mb-6 transition-all active:scale-95 text-[15px] uppercase tracking-widest shadow-2xl"
              >
                  <PackagePlus size={22} /> Add Spare Part
              </button>

              <div className="flex items-center gap-5">
                  <div className="flex-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Grand Total</p>
                     <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={handleSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.4] text-white font-black py-5 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 text-[18px] ${accentColor}`}
                  >
                     {loading ? <Loader2 className="animate-spin" size={26} /> : (
                        <><span className="uppercase text-sm tracking-widest">{mode === 'PURCHASE' ? 'Verify In' : 'Finalize'}</span> <ArrowRight size={22} /></>
                     )}
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};

export default DailyTransactions;