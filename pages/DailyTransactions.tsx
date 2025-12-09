
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
  Truck,
  X,
  CreditCard,
  AlertCircle
} from 'lucide-react';

interface Props {
  user: User;
  forcedMode?: 'SALES' | 'PURCHASE' | 'RETURN';
}

interface CartItem {
  tempId: string;
  partNumber: string;
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
  
  // Customer Suggestions State
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Mobile UI States
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  useEffect(() => {
    fetchInventory().then(setInventory);
    
    // Load customers for suggestions if in Sales mode
    if (forcedMode === 'SALES' || !forcedMode) {
      getCustomers().then(data => {
         // Safety check to ensure data is an array
         if (Array.isArray(data)) {
            setSavedCustomers(data);
         }
      });
    }
    
    // Click outside listener to close suggestions
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [forcedMode]);

  useEffect(() => {
    if (forcedMode) setMode(forcedMode);
  }, [forcedMode]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 1) {
       const matches = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       ).slice(0, 30); 
       setSuggestions(matches);
    } else {
       setSuggestions([]);
    }
  };

  const handleCustomerType = (val: string) => {
    setCustomerName(val);
    if ((mode === 'SALES' || !mode) && val.length > 0 && savedCustomers.length > 0) {
      const lowerVal = val.toLowerCase();
      const matches = savedCustomers.filter(c => {
        const nameMatch = c.name ? c.name.toLowerCase().includes(lowerVal) : false;
        const phoneMatch = c.phone ? c.phone.includes(val) : false;
        return nameMatch || phoneMatch;
      }).slice(0, 5);
      
      setCustomerSuggestions(matches);
      setShowCustomerList(true);
    } else {
      setShowCustomerList(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setShowCustomerList(false);
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
      
      // Strict stock check only for SALES
      if (mode === 'SALES' && item.quantity === 0) {
          alert("Item is out of stock!");
          return;
      }

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          partNumber: item.partNumber,
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          price: item.price,
          customerName: customerName,
          stockError: false
      };
      setCart([...cart, newItem]);
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
                  const maxStock = stockItem ? stockItem.quantity : 0;
                  
                  if (newQty > maxStock) {
                      newQty = maxStock;
                  }
                  
                  return { ...item, quantity: newQty, stockError: false };
              }
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const removeItem = (id: string) => {
      setCart(prev => prev.filter(i => i.tempId !== id));
  };

  const handleSubmit = async () => {
      if (cart.length === 0) return;
      
      // Mandatory Customer Name Check for Sales
      if (mode === 'SALES' && !customerName.trim()) {
        alert("Customer Name is mandatory for sales. Please select a customer or enter a name.");
        return;
      }

      if (mode === 'SALES' && cart.some(i => i.stockError)) {
          alert("Fix stock errors.");
          return;
      }
      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Unknown Supplier' : 'Walk-in'),
          createdByRole: user.role
      }));
      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);
      
      if (res.success) {
          if (user.role === Role.MANAGER) {
            alert("Requests successfully submitted to Admin for approval.");
          } else {
            alert(`Transaction successful.`);
          }

          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else {
          alert("Error: " + res.message);
      }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  const getButtonText = () => {
     if (user.role === Role.MANAGER) return 'Submit';
     if (mode === 'RETURN') return 'Refund';
     if (mode === 'PURCHASE') return 'Confirm';
     return 'Checkout';
  };

  const getThemeColor = () => {
      if (mode === 'RETURN') return 'text-red-900 border-red-200 bg-red-50';
      if (mode === 'PURCHASE') return 'text-blue-900 border-blue-200 bg-blue-50';
      return 'text-slate-800 border-slate-200 bg-white';
  };

  const getAccentColor = () => {
    if (mode === 'RETURN') return 'bg-red-600';
    if (mode === 'PURCHASE') return 'bg-blue-800';
    return 'bg-slate-900';
  };

  return (
    <div className="flex-1 h-full min-h-0 relative flex flex-col bg-slate-50 md:bg-transparent">
       
       {/* --- MOBILE: FULL SCREEN SEARCH MODAL (POS ITEM PICKER) --- */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-200">
            
            {/* 1. Top App Bar (Fixed) */}
            <div className="flex-none h-14 flex items-center px-2 gap-3 border-b border-slate-100 bg-white z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
               <button onClick={() => setShowMobileSearch(false)} className="p-2 rounded-full hover:bg-slate-50 text-slate-600">
                  <ArrowLeft size={24} />
               </button>
               <h3 className="font-bold text-lg text-slate-900 flex-1 leading-none pt-0.5">
                  Add Item
               </h3>
               {search && (
                  <button onClick={() => {setSearch(''); setSuggestions([]);}} className="p-2 text-slate-400">
                     <X size={20} />
                  </button>
               )}
            </div>

            {/* 2. Scrollable Container */}
            <div className="flex-1 overflow-y-auto bg-slate-50 relative">
               
               {/* Sticky Header Group (Search + Chips) */}
               <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-slate-100">
                   
                   {/* Search Bar */}
                   <div className="px-3 pb-2 pt-3">
                      <div className="relative bg-slate-100 rounded-xl flex items-center overflow-hidden border border-slate-200">
                         <div className="pl-3 text-slate-400">
                            <Search size={18} />
                         </div>
                         <input 
                            autoFocus
                            type="text" 
                            placeholder="Search Part No / Name..."
                            className="w-full bg-transparent p-3 pl-2 text-base font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                         />
                      </div>
                   </div>

                   {/* Filter Chips */}
                   <div className="px-3 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                      <button className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-full whitespace-nowrap shadow-sm">All Parts</button>
                      <button className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full whitespace-nowrap">Hyundai</button>
                      <button className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full whitespace-nowrap">Mahindra</button>
                   </div>
               </div>
               
               {/* 3. List Content */}
               <div className="p-3 space-y-2 pb-32">
                    {suggestions.map(item => (
                        <div 
                          key={item.id}
                          className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] transition-transform"
                        >
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="font-bold text-base text-slate-900 tracking-tight">{item.partNumber}</div>
                                <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.name}</div>
                                <div className={`text-[10px] mt-1.5 inline-block px-2 py-0.5 rounded font-bold uppercase tracking-wider ${item.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    Stock: {item.quantity}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                 <div className="font-bold text-slate-900 text-lg">₹{item.price}</div>
                                 <button 
                                   onClick={() => addToCart(item)}
                                   className="bg-blue-600 active:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm"
                                 >
                                    ADD +
                                 </button>
                            </div>
                        </div>
                    ))}
                    
                    {suggestions.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-24 text-slate-400">
                            {search.length > 1 ? (
                               <>
                                 <PackagePlus size={48} className="mb-4 opacity-20" />
                                 <div className="text-center font-medium">No items found</div>
                               </>
                            ) : (
                               <>
                                 <Search size={48} className="mb-4 opacity-20" />
                                 <div className="text-center font-medium">Type to search inventory</div>
                               </>
                            )}
                        </div>
                    )}
               </div>
            </div>
         </div>
       )}

       {/* --- DESKTOP LAYOUT (Grid) --- */}
       <div className="hidden lg:grid grid-cols-3 gap-6 h-full">
           {/* Left: Search & Suggestions */}
           <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className={`p-4 border-b flex items-center gap-2 ${getThemeColor()}`}>
                   <div className="relative flex-1">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                         type="text" 
                         placeholder={mode === 'RETURN' ? "Search item to return..." : "Search item..."}
                         className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm text-lg bg-white"
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                         autoFocus
                       />
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                         {suggestions.map(item => (
                            <button 
                              key={item.id}
                              onClick={() => addToCart(item)}
                              className="text-left p-4 rounded-lg border bg-white border-slate-200 hover:border-primary-300 transition-all hover:shadow-md"
                            >
                               <div className="flex justify-between items-start mb-2">
                                   <span className="font-bold text-slate-800">{item.partNumber}</span>
                                   <span className={`text-xs px-2 py-0.5 rounded ${item.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                       Stock: {item.quantity}
                                   </span>
                               </div>
                               <div className="text-sm text-slate-600 truncate mb-2">{item.name}</div>
                               <div className="font-bold text-primary-700">₹{item.price}</div>
                            </button>
                         ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <Search size={48} className="mb-4 opacity-20" />
                          <p>Start typing to search inventory</p>
                      </div>
                  )}
               </div>
           </div>

           {/* Right: Cart */}
           <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className={`p-4 border-b justify-between items-center bg-white border-slate-100 flex`}>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <ShoppingCart size={20} className="text-slate-400" />
                        {mode === 'SALES' ? 'Current Sale' : mode === 'RETURN' ? 'Returns' : 'Purchase Order'}
                    </h2>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg">Clear</button>}
                </div>
                
                {/* Customer Input Section */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 relative" ref={wrapperRef}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                       {mode === 'PURCHASE' ? "Supplier Name" : mode === 'RETURN' ? "Customer" : "Customer Name *"}
                    </label>
                    <div className="relative">
                        <input 
                           type="text" 
                           className={`w-full px-4 py-3 border rounded-xl text-base outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                             mode === 'SALES' && !customerName ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-300'
                           }`}
                           placeholder={mode === 'PURCHASE' ? "Enter Supplier" : "Enter Customer Name"}
                           value={customerName}
                           onChange={e => handleCustomerType(e.target.value)}
                           onFocus={() => {
                             if(mode === 'SALES' && customerName) setShowCustomerList(true);
                           }}
                        />
                        {/* Validation Indicator */}
                        {mode === 'SALES' && !customerName && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                             <AlertCircle size={16} className="text-red-400" />
                          </div>
                        )}
                    </div>
                    
                    {/* Customer Suggestion Dropdown */}
                    {showCustomerList && customerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 overflow-hidden animate-fade-in mx-1">
                         <div className="text-[10px] font-bold bg-slate-50 text-slate-400 px-3 py-1 uppercase tracking-wider">Suggestions</div>
                         {customerSuggestions.map(c => (
                            <button
                               key={c.id}
                               onClick={() => selectCustomer(c)}
                               className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                            >
                               <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                               <span className="text-xs text-slate-500">{c.phone || ''}</span>
                            </button>
                         ))}
                      </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-4">
                    {cart.length === 0 && <div className="text-center text-slate-400 py-10 text-sm italic">Cart is empty.</div>}
                    {cart.map(item => (
                        <div key={item.tempId} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-900">{item.partNumber}</div>
                                    <div className="text-xs text-slate-500">₹{item.price} x {item.quantity}</div>
                                </div>
                                <div className={`font-bold ${mode === 'RETURN' ? 'text-red-600' : 'text-slate-900'}`}>
                                    {mode === 'RETURN' ? '-' : ''}₹{item.price * item.quantity}
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                <button onClick={() => removeItem(item.tempId)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-8 h-8 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-700 active:scale-90"><Minus size={16}/></button>
                                    <span className="font-bold w-6 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-8 h-8 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-700 active:scale-90"><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-white border-t border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-500 font-medium text-sm">Total Amount</span>
                        <span className={`text-xl font-black ${mode === 'RETURN' ? 'text-red-600' : 'text-slate-900'}`}>{mode === 'RETURN' ? '-' : ''}₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button onClick={handleSubmit} disabled={loading || cart.length === 0} className={`w-full py-3.5 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${getAccentColor()}`}>
                       {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'RETURN' ? <Undo2 size={20}/> : <CheckCircle2 size={20}/>)}
                       {getButtonText()}
                    </button>
                </div>
           </div>
       </div>

       {/* --- MOBILE LAYOUT (POS Optimized) --- */}
       <div className="lg:hidden flex flex-col h-full bg-slate-50 relative overflow-hidden">
          
          {/* 1. Context Input (Compact & Top) */}
          <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-sm z-10 sticky top-0">
              <div className="flex flex-col gap-1 relative">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                    {mode === 'PURCHASE' ? "Supplier" : "Customer"} Details
                </label>
                <div className={`flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all ${mode === 'SALES' && !customerName ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'}`}>
                    {mode === 'PURCHASE' ? (
                       <Truck size={20} className="text-blue-500" />
                    ) : (
                       <UserIcon size={20} className="text-slate-400" />
                    )}
                    <input 
                       type="text"
                       className="flex-1 text-base bg-transparent outline-none font-semibold text-slate-900 placeholder:text-slate-400"
                       placeholder={mode === 'PURCHASE' ? "Select Supplier" : "Enter Name"}
                       value={customerName}
                       onChange={e => handleCustomerType(e.target.value)}
                       onFocus={() => {
                          if(mode === 'SALES' && customerName) setShowCustomerList(true);
                       }}
                    />
                     {cart.length > 0 && <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-md">{cart.length} Items</span>}
                </div>
                {/* Validation Dot */}
                {mode === 'SALES' && !customerName && <div className="absolute right-3 top-9 w-2 h-2 rounded-full bg-red-500 animate-pulse pointer-events-none"></div>}
                
                {/* Mobile Dropdown */}
                {showCustomerList && customerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-2 overflow-hidden animate-fade-in mx-1">
                         {customerSuggestions.map(c => (
                            <button
                               key={c.id}
                               onClick={() => selectCustomer(c)}
                               className="w-full text-left px-4 py-3.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex justify-between items-center active:bg-blue-50"
                            >
                               <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                               <span className="text-xs text-slate-500 font-medium">{c.phone || ''}</span>
                            </button>
                         ))}
                    </div>
                )}
              </div>
          </div>

          {/* 2. Scrollable Cart Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-[160px] bg-slate-50"> 
              {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center pt-20 opacity-50 space-y-4">
                     <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center">
                        <ShoppingCart size={40} className="text-slate-400" />
                     </div>
                     <div className="text-center">
                         <p className="text-lg font-bold text-slate-600">Cart Empty</p>
                         <p className="text-sm text-slate-400 max-w-[200px] mx-auto mt-1">Tap the "Add Item" button below to start billing.</p>
                     </div>
                  </div>
              ) : (
                  cart.map(item => (
                    <div key={item.tempId} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        {/* Part Details */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 mb-0.5 block tracking-wider">Part Number</span>
                                <div className="font-black text-slate-800 text-xl tracking-tight">{item.partNumber}</div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5">₹{item.price.toLocaleString()} / unit</div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold uppercase text-slate-400 mb-0.5 block tracking-wider">Amount</span>
                                <div className={`font-black text-xl tracking-tight ${mode === 'RETURN' ? 'text-red-600' : 'text-blue-600'}`}>
                                    {mode === 'RETURN' ? '-' : ''}₹{(item.price * item.quantity).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                              <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => item.quantity === 1 ? removeItem(item.tempId) : updateQty(item.tempId, -1)} 
                                    className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center text-slate-600 active:scale-90 border border-slate-200 transition-transform"
                                  >
                                      <Minus size={20}/>
                                  </button>
                                  <span className="font-black text-slate-900 w-8 text-center text-xl">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateQty(item.tempId, 1)} 
                                    className="w-10 h-10 bg-slate-900 shadow-sm rounded-lg flex items-center justify-center text-white active:scale-90 transition-transform"
                                  >
                                      <Plus size={20}/>
                                  </button>
                              </div>
                              <button 
                                onClick={() => removeItem(item.tempId)} 
                                className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 active:bg-red-50 rounded-lg transition-colors"
                              >
                                  <Trash2 size={20} />
                              </button>
                        </div>
                    </div>
                  ))
              )}
          </div>

          {/* 3. Fixed Bottom Stack */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-2xl border-t border-slate-100">
              
              {/* Action Row */}
              <div className="flex gap-3 p-4 pb-safe-bottom">
                  {/* Add Button */}
                  <button 
                    onClick={() => setShowMobileSearch(true)}
                    className="flex-1 bg-blue-50 text-blue-700 active:bg-blue-100 rounded-xl font-bold py-4 flex flex-col items-center justify-center gap-1 border border-blue-100 transition-colors"
                  >
                     <PackagePlus size={24} />
                     <span className="text-xs uppercase tracking-wide">Add Item</span>
                  </button>

                  {/* Checkout Button */}
                  <button 
                     onClick={handleSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-[2] rounded-xl font-bold text-white shadow-lg flex flex-col items-center justify-center relative overflow-hidden transition-transform active:scale-[0.98] disabled:opacity-50 disabled:scale-100 ${getAccentColor()}`}
                  >
                     <div className="flex items-center gap-2 mb-0.5">
                         {loading ? <Loader2 className="animate-spin" size={18} /> : (mode === 'RETURN' ? <Undo2 size={18}/> : <CheckCircle2 size={18}/>)}
                         <span className="text-sm uppercase tracking-wide">{getButtonText()}</span>
                     </div>
                     <div className="text-2xl font-black">
                         {mode === 'RETURN' ? '-' : ''}₹{totalAmount.toLocaleString()}
                     </div>
                  </button>
              </div>
          </div>

       </div>
    </div>
  );
};

export default DailyTransactions;
