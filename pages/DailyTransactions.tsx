import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Customer } from '../types';
import { createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getCustomers } from '../services/masterService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  CheckCircle2,
  Undo2,
  ShoppingCart,
  User as UserIcon,
  PackagePlus,
  ArrowLeft,
  X,
  AlertCircle,
  Zap,
  ShoppingBag,
  // Added missing ArrowRight import
  ArrowRight
} from 'lucide-react';

interface Props {
  user: User;
  forcedMode?: 'SALES' | 'PURCHASE' | 'RETURN';
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

const DailyTransactions: React.FC<Props> = ({ user, forcedMode }) => {
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
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

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 1) {
       setSuggestions(inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       ).slice(0, 30));
    } else setSuggestions([]);
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
          setSearch('');
          setSuggestions([]);
          setShowMobileSearch(false);
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
      setSearch('');
      setSuggestions([]);
      setShowMobileSearch(false);
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

  // Added removeItem function to handle item removal from cart
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

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in relative">
       
       {/* MOBILE SEARCH MODAL */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
            <div className="flex-none h-20 flex items-center px-6 gap-4 border-b border-slate-50">
               <button onClick={() => setShowMobileSearch(false)} className="p-2.5 bg-slate-50 rounded-2xl text-slate-600">
                  <ArrowLeft size={24} />
               </button>
               <h3 className="font-black text-xl text-slate-900 tracking-tight">Select Part</h3>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 no-scrollbar">
               <div className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md pb-6">
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                         autoFocus
                         type="text" 
                         className="w-full bg-white p-4 pl-12 rounded-3xl border border-slate-200 text-lg font-bold shadow-soft outline-none focus:ring-2 focus:ring-brand-500/10"
                         placeholder="Start typing Part No..."
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                      />
                   </div>
               </div>
               <div className="space-y-3">
                    {suggestions.map(item => (
                        <button 
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className="w-full flex items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-100 shadow-soft active:scale-95 transition-all text-left"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="font-black text-[17px] text-slate-900 leading-tight">{item.partNumber}</div>
                                <div className="text-[13px] text-slate-400 font-medium truncate mt-1">{item.name}</div>
                                <div className={`text-[10px] mt-2 inline-block px-2 py-0.5 rounded font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                                    In Stock: {item.quantity}
                                </div>
                            </div>
                            <div className="text-right">
                                 <div className="font-black text-slate-900 text-lg mb-2">₹{item.price.toLocaleString()}</div>
                                 <div className="bg-brand-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Select</div>
                            </div>
                        </button>
                    ))}
                    {suggestions.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-20 text-slate-300">
                            <Search size={64} className="mb-4 opacity-20" />
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Type part number or description</p>
                        </div>
                    )}
               </div>
            </div>
         </div>
       )}

       {/* DESKTOP LAYOUT */}
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
                                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>
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
                    {cart.length === 0 && (
                      <div className="text-center text-slate-300 py-10 font-bold uppercase tracking-widest text-[11px]">Cart is empty</div>
                    )}
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

       {/* MOBILE POINT OF SALE */}
       <div className="lg:hidden flex flex-col h-full bg-slate-50">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-48 no-scrollbar">
              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 mb-6 relative" ref={wrapperRef}>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">Customer Selection</span>
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                       <UserIcon className="text-slate-300" size={20} />
                       <input 
                          type="text"
                          className="flex-1 bg-transparent outline-none font-bold text-slate-900 placeholder:text-slate-300"
                          placeholder="Search or Enter Name"
                          value={customerName}
                          onChange={e => handleCustomerType(e.target.value)}
                       />
                       {mode === 'SALES' && !customerName && <AlertCircle size={18} className="text-rose-400" />}
                  </div>
                  {showCustomerList && customerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-100 rounded-3xl shadow-premium mt-3 overflow-hidden animate-slide-up mx-2">
                         {customerSuggestions.map(c => (
                            <button
                               key={c.id}
                               onClick={() => { setCustomerName(c.name); setShowCustomerList(false); }}
                               className="w-full text-left px-5 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                            >
                               <span className="font-bold text-slate-800">{c.name}</span>
                               <span className="text-xs text-slate-400 font-bold">{c.phone}</span>
                            </button>
                         ))}
                      </div>
                  )}
              </div>

              <div className="space-y-3">
                  {cart.length === 0 ? (
                      <div className="text-center py-20">
                         <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Zap size={36} className="text-slate-300" />
                         </div>
                         <p className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Cart is Empty</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className="bg-white p-5 rounded-[2rem] shadow-soft border border-slate-100 flex flex-col gap-4">
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-4">
                                  <div className="font-black text-slate-900 text-[16px] tracking-tight">{item.partNumber}</div>
                                  <div className="text-[13px] text-slate-500 font-medium truncate mt-1">{item.name}</div>
                                  <div className="text-[15px] font-black text-brand-600 mt-2">₹{item.price.toLocaleString()}</div>
                               </div>
                               <div className="text-right font-black text-slate-900 text-[17px]">
                                  ₹{(item.price * item.quantity).toLocaleString()}
                               </div>
                           </div>
                           <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                               <button onClick={() => removeItem(item.tempId)} className="text-rose-400 p-2.5 rounded-xl hover:bg-rose-50 transition-colors"><Trash2 size={20} /></button>
                               <div className="flex items-center gap-4 bg-slate-50 px-2 py-1.5 rounded-2xl border border-slate-100 shadow-inner">
                                   <button onClick={() => updateQty(item.tempId, -1)} className="w-10 h-10 bg-white shadow-soft rounded-xl flex items-center justify-center text-slate-400 active:scale-90 transition-all"><Minus size={18}/></button>
                                   <span className="w-8 text-center font-black text-[16px] text-slate-800">{item.quantity}</span>
                                   <button onClick={() => updateQty(item.tempId, 1)} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shadow-lg"><Plus size={18}/></button>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          <div className="fixed bottom-[70px] left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-6 shadow-premium z-40 pb-safe-bottom">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-4 rounded-[1.5rem] flex items-center justify-center gap-3 mb-6 transition-all active:scale-95 text-[15px] uppercase tracking-widest"
              >
                  <PackagePlus size={22} /> Add Spare Part
              </button>

              <div className="flex items-center gap-6">
                  <div className="flex-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                     <p className="text-3xl font-black text-slate-900 tracking-tight">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={handleSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.5] text-white font-black py-5 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 text-[17px] ${accentColor}`}
                  >
                     {loading ? <Loader2 className="animate-spin" size={24} /> : (
                        <>Checkout <ArrowRight size={22} /></>
                     )}
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};

export default DailyTransactions;