
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
  Percent,
  Banknote,
  Activity
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const formatQty = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

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
  price: number; // This is the Net Price (MRP - Discount) saved to DB
  mrp: number;   // Original MRP for calculation
  discount: number; // Percentage
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
  
  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);

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

      // Standard Purchase Discount is 12% by default as per shop rule
      const initialDiscount = mode === 'PURCHASE' ? 12 : 0;
      const initialPrice = mode === 'PURCHASE' 
        ? item.price * (1 - initialDiscount / 100) 
        : item.price;

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          mrp: item.price,
          discount: initialDiscount,
          price: initialPrice,
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

  const handleManualQtyChange = (id: string, val: string) => {
    let newQty = parseInt(val);
    if (isNaN(newQty)) newQty = 0; // Allow zero or empty temporarily while typing

    setCart(prev => prev.map(item => {
        if (item.tempId === id) {
            // Apply maximum validation immediately
            if (mode === 'SALES') {
                const stockItem = inventory.find(i => i.partNumber === item.partNumber);
                if (stockItem && newQty > stockItem.quantity) newQty = stockItem.quantity;
            }
            return { ...item, quantity: newQty };
        }
        return item;
    }));
  };

  const handleManualQtyBlur = (id: string) => {
    setCart(prev => prev.map(item => {
        if (item.tempId === id && item.quantity < 1) {
            return { ...item, quantity: 1 };
        }
        return item;
    }));
  };

  const handleDiscountChange = (id: string, val: string) => {
    const disc = parseFloat(val) || 0;
    setCart(prev => prev.map(item => {
      if (item.tempId === id) {
        const netPrice = item.mrp * (1 - disc / 100);
        return { ...item, discount: disc, price: netPrice };
      }
      return item;
    }));
  };

  const handleNetPriceChange = (id: string, val: string) => {
    const net = parseFloat(val) || 0;
    setCart(prev => prev.map(item => {
      if (item.tempId === id) {
        const disc = item.mrp > 0 ? ((item.mrp - net) / item.mrp) * 100 : 0;
        return { ...item, price: net, discount: parseFloat(disc.toFixed(2)) };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.tempId !== id));
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (mode === 'SALES' && !customerName.trim()) return alert("Customer Name is required.");
    
    // For Returns, we show a confirmation dialog
    if (mode === 'RETURN') {
      setShowConfirm(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Manual Supplier' : 'Walk-in'),
          createdByRole: user.role
      }));
      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);
      setShowConfirm(false);
      
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
            <div className="flex-none h-24 flex items-end px-6 pb-5 gap-4 bg-white border-b border-slate-100 shadow-sm">
               <button onClick={() => { setShowMobileSearch(false); setHideFilters(false); }} className="p-3 text-slate-900 bg-slate-50 rounded-2xl active:scale-90 transition-all border border-slate-100 shadow-soft">
                  <ArrowLeft size={24} strokeWidth={3} />
               </button>
               <div className="flex-1">
                  <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none uppercase">Catalog Hub</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] mt-2">Active Database Scan</p>
               </div>
               <button 
                  onClick={() => setHideFilters(!hideFilters)} 
                  className={`p-3 rounded-2xl transition-all shadow-soft border ${hideFilters ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-300 bg-slate-50 border-slate-100'}`}
               >
                  <Filter size={20} strokeWidth={2.5} />
               </button>
            </div>
            
            <div className={`flex-none bg-white transition-all duration-300 ease-in-out overflow-hidden ${hideFilters ? 'max-h-[84px]' : 'max-h-[160px]'}`}>
                <div className="p-6 space-y-5">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={24} strokeWidth={2.5} />
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full bg-slate-100/50 p-5 pl-14 rounded-3xl border-none text-[18px] font-black shadow-inner outline-none ring-2 ring-transparent focus:ring-blue-500/10 transition-all placeholder:text-slate-300 uppercase tracking-tight"
                            placeholder="Find Part..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                        />
                        {search && (
                          <button onClick={() => handleSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 bg-rose-50 p-2 rounded-xl active:scale-90 transition-all border border-rose-100">
                            <X size={18} strokeWidth={3} />
                          </button>
                        )}
                    </div>
                    
                    {!hideFilters && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 animate-fade-in">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                              <button
                                  key={b}
                                  onClick={() => { setSelectedBrand(b); handleSearch(search); }}
                                  className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all active:scale-[0.97] ${selectedBrand === b ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}
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
              className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-50/30"
            >
                {suggestions.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="w-full bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-premium flex justify-between items-center text-left active:scale-[0.97] transition-all group"
                    >
                        <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-3 mb-2.5">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                    {item.brand.slice(0,3)}
                                </span>
                                <div className="font-black text-slate-900 text-[19px] tracking-tighter truncate group-active:text-blue-600 transition-colors uppercase leading-none">{item.partNumber}</div>
                            </div>
                            <div className="text-[13px] text-slate-400 font-bold truncate mb-4 pl-1">{item.name}</div>
                            <div className="flex items-center gap-3 pl-1">
                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shadow-inner-soft ${item.quantity > 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                   STK: {formatQty(item.quantity)} Units
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-4">
                            <div className="font-black text-slate-900 text-2xl tracking-tighter">₹{item.price.toLocaleString()}</div>
                            <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] shadow-xl shadow-blue-100 flex items-center justify-center group-active:scale-90 transition-all">
                                <Plus size={28} strokeWidth={3.5} />
                            </div>
                        </div>
                    </button>
                ))}
                
                {search.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-40 text-slate-200">
                      <div className="w-28 h-28 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-soft border border-slate-100 animate-pulse">
                        <Activity size={56} className="opacity-10 text-blue-600" />
                      </div>
                      <p className="font-black text-[12px] uppercase tracking-[0.5em] text-slate-400">Ledger Scanner</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-4 uppercase tracking-[0.2em]">Input Part Number To Begin</p>
                   </div>
                )}
            </div>
         </div>
       )}

       {/* DESKTOP UI (Shared) */}
       <div className="hidden lg:grid grid-cols-12 gap-10 h-full p-1">
           <div className="col-span-8 bg-white rounded-[3rem] shadow-premium border border-slate-200/60 flex flex-col overflow-hidden transition-all group-focus-within:border-blue-200">
               <div className="p-10 border-b border-slate-50 bg-slate-50/30">
                   <div className="relative group/search">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-blue-600 transition-colors" size={26} strokeWidth={2.5} />
                       <input 
                         type="text" 
                         className="w-full pl-16 pr-6 py-6 bg-white border border-slate-200 rounded-[2.5rem] text-2xl font-black placeholder:text-slate-200 focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 shadow-inner-soft outline-none transition-all uppercase tracking-tight"
                         placeholder="Start Adding Parts..."
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                         autoFocus
                       />
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-10 no-scrollbar bg-white">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-6">
                         {suggestions.map(item => (
                            <button 
                              key={item.id}
                              onClick={() => addToCart(item)}
                              className="group/btn text-left p-8 rounded-[2.5rem] border-2 border-slate-50 bg-white hover:border-blue-100 hover:shadow-elevated transition-all duration-300 active:scale-[0.98]"
                            >
                               <div className="flex justify-between items-start mb-4">
                                   <span className="font-black text-xl text-slate-900 group-hover/btn:text-blue-600 transition-colors tracking-tight uppercase leading-none">{item.partNumber}</span>
                                   <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-[0.2em] border shadow-sm ${item.quantity > 0 ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                       {formatQty(item.quantity)} In-Stock
                                   </span>
                               </div>
                               <div className="text-[14px] text-slate-400 font-bold truncate mb-6 uppercase tracking-tight">{item.name}</div>
                               <div className="flex justify-between items-end">
                                  <div className="font-black text-2xl text-slate-900 tracking-tighter">₹{item.price.toLocaleString()}</div>
                                  <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100 opacity-0 group-hover/btn:opacity-100 transition-all transform translate-y-2 group-hover/btn:translate-y-0 active:scale-90">
                                     <Plus size={22} strokeWidth={3.5} />
                                  </div>
                               </div>
                            </button>
                         ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-200">
                          <PackagePlus size={96} className="mb-10 opacity-5" />
                          <p className="font-black text-slate-300 uppercase tracking-[0.5em] text-[13px]">Catalogue Ready</p>
                          <p className="text-[10px] font-bold text-slate-200 mt-4 uppercase tracking-[0.2em]">Enter SKU to initialize session</p>
                      </div>
                  )}
               </div>
           </div>

           <div className="col-span-4 bg-[#F1F5F9] rounded-[3rem] shadow-premium border border-slate-200/60 flex flex-col overflow-hidden relative">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/40 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="p-10 border-b border-slate-200/60 flex justify-between items-center relative z-10">
                    <h2 className="font-black text-2xl text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-lg"><ShoppingCart size={22} strokeWidth={2.5} /></div> Billed Items
                    </h2>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase tracking-[0.25em] hover:bg-rose-50 px-4 py-2 rounded-xl transition-all active:scale-95 border border-rose-100">Empty</button>
                    )}
                </div>
                
                <div className="p-10 pb-6 space-y-6 relative z-10" ref={wrapperRef}>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3 block ml-2">Verified Recipient</span>
                        <div className="relative group">
                            <input 
                               type="text" 
                               className="w-full px-6 py-5 bg-white border border-slate-200 rounded-3xl text-[17px] font-black outline-none focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 transition-all shadow-soft placeholder:text-slate-200 uppercase tracking-tight"
                               placeholder="Customer Identity"
                               value={customerName}
                               onChange={e => handleCustomerType(e.target.value)}
                            />
                            {showCustomerList && customerSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-[110] bg-white border border-slate-200 rounded-[2rem] shadow-elevated mt-4 overflow-hidden animate-slide-up p-2">
                                 {customerSuggestions.map(c => (
                                    <button
                                       key={c.id}
                                       onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                       className="w-full text-left px-6 py-4.5 hover:bg-slate-50 rounded-[1.25rem] border-b border-slate-50 last:border-0 flex justify-between items-center transition-all group/cust"
                                    >
                                       <div className="flex flex-col">
                                          <span className="font-black text-slate-800 text-[16px] group-hover/cust:text-blue-600 transition-colors uppercase leading-none mb-1">{c.name}</span>
                                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{c.type}</span>
                                       </div>
                                       <span className="text-[12px] text-slate-500 font-black bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-inner-soft tabular-nums">{c.phone}</span>
                                    </button>
                                 ))}
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 pt-0 space-y-5 no-scrollbar relative z-10">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-6 rounded-[2rem] border border-slate-200/80 bg-white flex flex-col gap-5 group hover:shadow-soft transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4 flex-1">
                                    <div className="font-black text-slate-900 text-[16px] tracking-tight uppercase leading-none mb-1.5">{item.partNumber}</div>
                                    <div className="text-[11px] text-slate-400 font-bold line-clamp-1 uppercase tracking-tight">{item.name}</div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className="font-black text-slate-900 text-[18px] tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</div>
                                    <div className="text-[9px] text-slate-300 font-black uppercase mt-1 tracking-widest bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">MRP ₹{item.mrp}</div>
                                </div>
                            </div>

                            {/* Discount Logic Row */}
                            {(mode === 'PURCHASE' || mode === 'SALES') && (
                              <div className="flex gap-3 items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100 shadow-inner-soft">
                                 <div className="flex-1 relative">
                                    <Percent size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2.5} />
                                    <input 
                                      type="number"
                                      className="w-full pl-9 pr-2 py-2 bg-white border border-slate-100 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 shadow-sm"
                                      placeholder="Disc %"
                                      value={item.discount}
                                      onChange={e => handleDiscountChange(item.tempId, e.target.value)}
                                    />
                                 </div>
                                 <div className="w-px h-6 bg-slate-200"></div>
                                 <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[11px]">₹</span>
                                    <input 
                                      type="number"
                                      className="w-full pl-7 pr-2 py-2 bg-white border border-slate-100 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 shadow-sm"
                                      placeholder={mode === 'SALES' ? "Price" : "Net"}
                                      value={item.price}
                                      onChange={e => handleNetPriceChange(item.tempId, e.target.value)}
                                    />
                                 </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-1">
                                <button onClick={() => removeItem(item.tempId)} className="text-slate-300 hover:text-rose-500 p-2.5 rounded-2xl hover:bg-rose-50 transition-all active:scale-90 border border-transparent hover:border-rose-100"><Trash2 size={20}/></button>
                                <div className="flex items-center gap-4 bg-slate-50 px-2 py-2 rounded-2xl shadow-inner-soft border border-slate-100">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 active:scale-90 transition-all bg-white border border-slate-200 shadow-soft"><Minus size={18} strokeWidth={3}/></button>
                                    <input 
                                      type="number"
                                      className="font-black w-12 text-center text-lg border-none focus:ring-0 p-0 bg-transparent text-slate-900 tabular-nums"
                                      value={item.quantity === 0 ? '' : formatQty(item.quantity)}
                                      onChange={e => handleManualQtyChange(item.tempId, e.target.value)}
                                      onBlur={() => handleManualQtyBlur(item.tempId)}
                                    />
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shadow-lg border border-slate-800"><Plus size={18} strokeWidth={3}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-10 border-t border-slate-200/60 bg-white relative z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
                    <div className="flex justify-between items-end mb-8 px-2">
                        <div className="space-y-1">
                           <span className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Settlement Amount</span>
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)] animate-pulse"></div>
                              <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Valid Transaction</span>
                           </div>
                        </div>
                        <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={handleCheckoutClick} 
                       disabled={loading || cart.length === 0} 
                       className={`w-full py-6 rounded-[2rem] font-black text-white text-[18px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-4 uppercase tracking-[0.1em] ${accentColor}`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={24} /> : (
                         <>Verify Transaction <ArrowRight size={26} strokeWidth={2.5} /></>
                       )}
                    </button>
                </div>
           </div>
       </div>

       {/* MOBILE POINT OF SALE MAIN SCREEN */}
       <div className="lg:hidden flex flex-col h-full bg-[#F8FAFC]">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-60 no-scrollbar">
              
              {/* Customer Selection Mobile */}
              {mode === 'SALES' && (
                <div className="bg-white p-8 rounded-[3rem] shadow-soft border border-slate-200/60 mb-8 relative group" ref={wrapperRef}>
                    <div className="flex items-center justify-between mb-5 px-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Bill Assignment</span>
                        {customerName && <button onClick={() => setCustomerName('')} className="text-[10px] font-black text-rose-500 uppercase px-4 py-1.5 bg-rose-50 rounded-xl border border-rose-100 shadow-sm active:scale-95 transition-all">Clear</button>}
                    </div>
                    <div className="flex items-center gap-5 bg-slate-100/50 p-5 rounded-[1.75rem] border-2 border-transparent focus-within:border-blue-500/10 focus-within:bg-white focus-within:ring-12 focus-within:ring-blue-500/5 transition-all shadow-inner-soft">
                        <UserIcon className="text-slate-300" size={24} strokeWidth={2.5} />
                        <input 
                            type="text"
                            className="flex-1 bg-transparent outline-none font-black text-slate-900 placeholder:text-slate-300 text-xl tracking-tight uppercase"
                            placeholder="Identify Client..."
                            value={customerName}
                            onChange={e => handleCustomerType(e.target.value)}
                        />
                    </div>
                    {showCustomerList && customerSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[60] bg-white border border-slate-200 rounded-[2.5rem] shadow-premium mt-4 overflow-hidden animate-slide-up mx-2 p-2">
                            {customerSuggestions.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                    className="w-full text-left px-6 py-5 hover:bg-slate-50 rounded-[1.5rem] border-b border-slate-50 last:border-0 flex justify-between items-center active:bg-slate-100 transition-all group/m"
                                >
                                    <div>
                                       <span className="font-black text-slate-800 text-lg block uppercase tracking-tight group-active/m:text-blue-600">{c.name}</span>
                                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.type}</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-black bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 tabular-nums">{c.phone}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              )}

              {/* Shopping Cart List Mobile */}
              <div className="space-y-6">
                  <div className="flex items-center justify-between px-4 mb-4">
                     <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">Billed Register ({formatQty(cart.length)})</h4>
                     {cart.length > 0 && <button onClick={() => setCart([])} className="text-[11px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-lg">Purge</button>}
                  </div>

                  {cart.length === 0 ? (
                      <div className="bg-white/40 border-4 border-dashed border-slate-200 rounded-[3.5rem] p-20 text-center shadow-inner-soft">
                         <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-soft border border-slate-100">
                            <ShoppingCart size={36} strokeWidth={2.5} className="text-slate-200" />
                         </div>
                         <p className="font-black text-slate-300 uppercase tracking-[0.5em] text-[11px]">Register Closed</p>
                         <p className="text-[9px] font-bold text-slate-200 mt-4 uppercase tracking-[0.2em]">Add Parts to open a bill</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className="bg-white p-8 rounded-[3rem] shadow-premium border border-slate-200/60 flex flex-col gap-8 animate-fade-in relative overflow-hidden group">
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-6">
                                  <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none mb-2 uppercase">{item.partNumber}</div>
                                  <div className="text-[14px] text-slate-400 font-bold truncate leading-none uppercase tracking-tight">{item.name}</div>
                               </div>
                               <div className="text-right">
                                  <div className="font-black text-slate-900 text-2xl tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</div>
                                  <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-2 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Net ₹{item.price.toFixed(2)}</div>
                               </div>
                           </div>

                           {/* Mobile Discount Row */}
                           {(mode === 'PURCHASE' || mode === 'SALES') && (
                             <div className="flex gap-5 items-center bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner-soft">
                                <div className="flex-1 space-y-2.5">
                                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-2">Discount %</label>
                                   <div className="relative">
                                      <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" strokeWidth={3} />
                                      <input 
                                        type="number"
                                        className="w-full pl-11 pr-3 py-4 bg-white border border-slate-200 rounded-2xl text-[17px] font-black outline-none focus:ring-12 focus:ring-blue-500/5 transition-all shadow-sm"
                                        value={item.discount}
                                        onChange={e => handleDiscountChange(item.tempId, e.target.value)}
                                      />
                                   </div>
                                </div>
                                <div className="flex-1 space-y-2.5">
                                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-2">Final Rate</label>
                                   <div className="relative">
                                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">₹</span>
                                      <input 
                                        type="number"
                                        className="w-full pl-10 pr-3 py-4 bg-white border border-slate-200 rounded-2xl text-[17px] font-black outline-none focus:ring-12 focus:ring-blue-500/5 transition-all shadow-sm"
                                        value={item.price}
                                        onChange={e => handleNetPriceChange(item.tempId, e.target.value)}
                                      />
                                   </div>
                                </div>
                             </div>
                           )}

                           <div className="flex items-center justify-between border-t border-slate-50 pt-8">
                               <button onClick={() => removeItem(item.tempId)} className="w-16 h-16 flex items-center justify-center bg-rose-50 text-rose-500 rounded-[1.5rem] active:scale-90 transition-all border border-rose-100/50 shadow-soft"><Trash2 size={28} /></button>
                               <div className="flex items-center gap-8 bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200/60 shadow-inner-soft">
                                   <button onClick={() => updateQty(item.tempId, -1)} className="w-14 h-14 bg-white shadow-soft rounded-[1.25rem] flex items-center justify-center text-slate-600 active:scale-90 transition-all border border-slate-200"><Minus size={24} strokeWidth={4}/></button>
                                   <input 
                                      type="number"
                                      className="w-14 text-center font-black text-3xl text-slate-900 bg-transparent border-none focus:ring-0 p-0 tabular-nums"
                                      value={item.quantity === 0 ? '' : formatQty(item.quantity)}
                                      onChange={e => handleManualQtyChange(item.tempId, e.target.value)}
                                      onBlur={() => handleManualQtyBlur(item.tempId)}
                                    />
                                   <button onClick={() => updateQty(item.tempId, 1)} className={`w-14 h-14 ${accentColor} text-white shadow-xl rounded-[1.25rem] flex items-center justify-center active:scale-90 transition-all border border-black/10`}><Plus size={24} strokeWidth={4}/></button>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          {/* Sticky Checkout Bar Mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-200/60 p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.12)] z-[80] pb-safe rounded-t-[3rem]">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-4 mb-8 transition-all active:scale-95 text-[17px] uppercase tracking-[0.2em] shadow-2xl border border-white/5"
              >
                  <PackagePlus size={26} strokeWidth={2.5} /> Add Spare Part
              </button>

              <div className="flex items-center gap-8">
                  <div className="flex-1 px-2">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Grand Total</p>
                     <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={handleCheckoutClick}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.5] text-white font-black py-6 rounded-[2.25rem] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 text-[20px] shadow-blue-200/40 ${accentColor}`}
                  >
                     {loading ? <Loader2 className="animate-spin" size={28} /> : (
                        <><span className="uppercase text-[13px] tracking-[0.15em] font-black">{mode === 'PURCHASE' ? 'Verify In' : 'Finalize'}</span> <ArrowRight size={28} strokeWidth={3} /></>
                     )}
                  </button>
              </div>
          </div>
       </div>

       {/* RETURN CONFIRMATION MODAL */}
       <ConfirmModal
         isOpen={showConfirm}
         onClose={() => setShowConfirm(false)}
         onConfirm={executeSubmit}
         loading={loading}
         variant="danger"
         title="Protocol Check: Verify Return"
         message={`Security checkpoint: Confirm the refund and restock of ${formatQty(cart.length)} unit(s) for a total value of ₹${totalAmount.toLocaleString()}. This action will immediately adjust physical inventory counts.`}
         confirmLabel="Confirm & Release"
       />
    </div>
  );
};

export default DailyTransactions;
