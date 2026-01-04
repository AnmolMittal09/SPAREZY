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
  Percent
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const formatQty = (n: number | string) => {
  const num = typeof n === 'string' ? parseInt(n) : n;
  if (isNaN(num)) return '00';
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return isNeg ? `-${str}` : str;
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
    if (isNaN(newQty)) newQty = 0;

    setCart(prev => prev.map(item => {
        if (item.tempId === id) {
            if (mode === 'SALES') {
                const stockItem = inventory.find(i => i.partNumber === item.partNumber);
                if (stockItem && newQty > stockItem.quantity) newQty = stockItem.quantity;
            }
            return { ...item, quantity: newQty };
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

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (mode === 'SALES' && !customerName.trim()) return alert("Customer Name is required.");
    
    if (mode === 'RETURN') {
      setShowConfirm(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Supplier' : 'Walk-in'),
          createdByRole: user.role
      }));
      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);
      setShowConfirm(false);
      
      if (res.success) {
          alert(user.role === Role.MANAGER ? "Sent for approval." : "Success.");
          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else alert("Error: " + res.message);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in relative overflow-hidden">
       {showMobileSearch && (
         <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-slide-up h-[100dvh] w-screen overflow-hidden">
            <div className="flex-none h-24 flex items-end px-5 pb-4 gap-4 bg-white border-b border-slate-100 shadow-sm">
               <button onClick={() => setShowMobileSearch(false)} className="p-3 text-slate-900 bg-slate-100 rounded-2xl">
                  <ArrowLeft size={24} strokeWidth={2.5} />
               </button>
               <div className="flex-1">
                  <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none">Find Part</h3>
               </div>
            </div>
            <div className="p-5 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
                    <input 
                        autoFocus
                        type="text" 
                        className="w-full bg-slate-50 p-4 pl-12 rounded-2xl border-none font-bold outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-brand-500/20 transition-all"
                        placeholder="Type part number..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-[#F8FAFC]">
                {suggestions.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="w-full bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-premium flex justify-between items-center text-left active:scale-[0.97] transition-all"
                    >
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>{item.brand.substring(0,3)}</span>
                                <div className="font-black text-slate-900 text-lg tracking-tight truncate">{item.partNumber}</div>
                            </div>
                            <div className="text-[13px] text-slate-400 font-bold truncate mb-3">{item.name}</div>
                            <div className="text-[10px] font-black uppercase text-slate-300 tracking-widest">
                                Stock: <span className={item.quantity > 0 ? 'text-slate-600' : 'text-rose-500'}>{formatQty(item.quantity)} Units</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-black text-slate-900 text-xl tracking-tight">₹{item.price.toLocaleString()}</div>
                        </div>
                    </button>
                ))}
            </div>
         </div>
       )}

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
                              className="group text-left p-6 rounded-[2rem] border-2 border-slate-50 bg-white hover:border-brand-200 hover:shadow-xl transition-all"
                            >
                               <div className="flex justify-between items-start mb-3">
                                   <span className="font-black text-lg text-slate-900 group-hover:text-brand-600">{item.partNumber}</span>
                                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                                       {formatQty(item.quantity)} In Stock
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
                          <p className="font-bold text-slate-400 uppercase tracking-[0.2em] text-xs">Ready for input</p>
                      </div>
                  )}
               </div>
           </div>

           <div className="col-span-4 bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col overflow-visible">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
                        <ShoppingCart size={22} className="text-brand-600" /> Cart
                    </h2>
                </div>
                <div className="p-8 pb-4 space-y-4 relative" ref={wrapperRef}>
                    <div className="relative">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block ml-1">Customer Info</span>
                        <input 
                            type="text" 
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[15px] font-bold focus:ring-2 focus:ring-brand-500/10 transition-all outline-none"
                            placeholder="Name or Phone"
                            value={customerName}
                            onChange={e => handleCustomerType(e.target.value)}
                        />
                        {showCustomerList && customerSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-100 rounded-2xl shadow-premium mt-2 overflow-hidden animate-slide-up">
                             {customerSuggestions.map(c => (
                                <button
                                   key={c.id}
                                   onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                   className="w-full text-left px-5 py-3.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                                >
                                   <div>
                                      <span className="font-bold text-slate-800 block">{c.name}</span>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.phone}</span>
                                   </div>
                                </button>
                             ))}
                          </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-900 text-[15px]">{item.partNumber}</div>
                                    <div className="text-xs text-slate-500 truncate">{item.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={() => setCart(prev => prev.filter(c => c.tempId !== item.tempId))} className="text-rose-500 p-2"><Trash2 size={18}/></button>
                                <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl shadow-soft">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-8 h-8 text-slate-400"><Minus size={16}/></button>
                                    <span className="font-black text-slate-900 min-w-[20px] text-center">{formatQty(item.quantity)}</span>
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center"><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 border-t border-slate-50">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Total</span>
                        <span className="text-3xl font-black text-slate-900">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={handleCheckoutClick} 
                       disabled={loading || cart.length === 0} 
                       className={`w-full py-5 rounded-[1.5rem] font-black text-white text-[17px] shadow-xl flex items-center justify-center gap-3 ${accentColor}`}
                    >
                       {loading ? <Loader2 className="animate-spin" /> : <>Checkout <ArrowRight size={22} /></>}
                    </button>
                </div>
           </div>
       </div>

       {/* MOBILE POINT OF SALE MAIN SCREEN */}
       <div className="lg:hidden flex flex-col h-full bg-[#F8FAFC]">
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-52 no-scrollbar">
              {mode === 'SALES' && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 mb-6 relative" ref={wrapperRef}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                    </div>
                    <input 
                        type="text"
                        className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-slate-900 placeholder:text-slate-300 text-lg border-none"
                        placeholder="Search or Type Name..."
                        value={customerName}
                        onChange={e => handleCustomerType(e.target.value)}
                    />
                    {showCustomerList && customerSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[60] bg-white border border-slate-100 rounded-3xl shadow-premium mt-3 overflow-hidden">
                            {customerSuggestions.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                                    className="w-full text-left px-6 py-4 border-b border-slate-50 last:border-0"
                                >
                                    <span className="font-bold text-slate-800 block">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.phone}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              )}

              <div className="space-y-4">
                  {cart.length === 0 ? (
                      <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center">
                         <ShoppingCart size={32} className="text-slate-200 mx-auto mb-4" />
                         <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-[11px]">Empty Cart</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className="bg-white p-6 rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col gap-6">
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-4">
                                  <div className="font-black text-slate-900 text-xl tracking-tight leading-none mb-1">{item.partNumber}</div>
                                  <div className="text-[13px] text-slate-400 font-bold truncate">{item.name}</div>
                               </div>
                               <div className="text-right">
                                  <div className="font-black text-slate-900 text-xl">₹{(item.price * item.quantity).toLocaleString()}</div>
                               </div>
                           </div>
                           <div className="flex items-center justify-between border-t border-slate-50 pt-5">
                               <button onClick={() => setCart(prev => prev.filter(c => c.tempId !== item.tempId))} className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl"><Trash2 size={22} /></button>
                               <div className="flex items-center gap-6 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                                   <button onClick={() => updateQty(item.tempId, -1)} className="w-11 h-11 bg-white shadow-soft rounded-xl flex items-center justify-center text-slate-600"><Minus size={20} strokeWidth={3}/></button>
                                   <span className="text-2xl font-black text-slate-900">{formatQty(item.quantity)}</span>
                                   <button onClick={() => updateQty(item.tempId, 1)} className={`w-11 h-11 ${accentColor} text-white shadow-lg rounded-xl flex items-center justify-center`}><Plus size={20} strokeWidth={3}/></button>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 p-6 shadow-elevated z-[80] pb-safe">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 mb-6 shadow-2xl"
              >
                  <PackagePlus size={22} /> Add Item
              </button>
              <div className="flex items-center gap-5">
                  <div className="flex-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</p>
                     <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={handleCheckoutClick}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.4] text-white font-black py-5 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 ${accentColor}`}
                  >
                     {loading ? <Loader2 className="animate-spin" /> : <><span className="uppercase text-sm tracking-widest">Finalize</span> <ArrowRight size={22} /></>}
                  </button>
              </div>
          </div>
       </div>

       <ConfirmModal
         isOpen={showConfirm}
         onClose={() => setShowConfirm(false)}
         onConfirm={executeSubmit}
         loading={loading}
         variant="danger"
         title="Verify Return?"
         message={`Refunding ₹${totalAmount.toLocaleString()} for ${formatQty(cart.length)} items. This will restock items into inventory.`}
         confirmLabel="Confirm & Restock"
       />
    </div>
  );
};

export default DailyTransactions;