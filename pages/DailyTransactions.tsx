import React, { useEffect, useState } from 'react';
import { Role, TransactionType, User, StockItem } from '../types';
import { createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  CheckCircle2,
  Undo2,
  ShoppingCart,
  X,
  User as UserIcon,
  PackagePlus,
  ArrowLeft
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
  
  // Mobile UI States
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

  useEffect(() => {
    if (forcedMode) setMode(forcedMode);
  }, [forcedMode]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 1) {
       const matches = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       ).slice(0, 20); // Increased limit for better mobile scrolling
       setSuggestions(matches);
    } else {
       setSuggestions([]);
    }
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
      if (mode === 'SALES' && cart.some(i => i.stockError)) {
          alert("Fix stock errors.");
          return;
      }
      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Unknown Supplier' : (mode === 'RETURN' ? 'Return Customer' : 'Walk-in')),
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
    <div className="flex-1 h-full min-h-0 relative flex flex-col bg-slate-50">
       
       {/* --- MOBILE: FULL SCREEN SEARCH MODAL (POS ITEM PICKER) --- */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[80] bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-200">
            {/* Modal Header */}
            <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white sticky top-0 z-10">
               <button onClick={() => setShowMobileSearch(false)} className="p-2 -ml-2 text-slate-500">
                  <ArrowLeft size={24} />
               </button>
               <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     autoFocus
                     type="text" 
                     placeholder="Search Part No / Name..."
                     className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-base focus:ring-2 focus:ring-blue-500 outline-none"
                     value={search}
                     onChange={e => handleSearch(e.target.value)}
                   />
               </div>
            </div>
            
            {/* Category Chips (Mock) */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50">
               <button className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-full whitespace-nowrap">All Parts</button>
               <button className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full whitespace-nowrap">Hyundai</button>
               <button className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full whitespace-nowrap">Mahindra</button>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-2 pb-20">
                {suggestions.map(item => (
                    <button 
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="w-full text-left p-3 mb-2 rounded-xl border border-slate-100 shadow-sm bg-white active:scale-[0.98] transition-transform flex justify-between items-center"
                    >
                        <div>
                            <div className="font-bold text-base text-slate-900">{item.partNumber}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{item.name}</div>
                            <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded w-fit font-bold ${item.quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                Stock: {item.quantity}
                            </div>
                        </div>
                        <div className="text-right pl-4">
                            <div className="font-bold text-blue-600 text-lg">₹{item.price}</div>
                            <div className="text-[10px] text-blue-400 font-bold uppercase">Add +</div>
                        </div>
                    </button>
                ))}
                {suggestions.length === 0 && search.length > 1 && (
                    <div className="text-center text-slate-400 mt-10">No items found.</div>
                )}
                {suggestions.length === 0 && search.length <= 1 && (
                    <div className="text-center text-slate-400 mt-10 text-sm">Type to search inventory...</div>
                )}
            </div>
         </div>
       )}

       {/* --- DESKTOP LAYOUT (Original Grid) --- */}
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
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <input 
                       type="text" 
                       className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                       placeholder={mode === 'PURCHASE' ? "Supplier Name" : "Customer Name (Optional)"}
                       value={customerName}
                       onChange={e => setCustomerName(e.target.value)}
                    />
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
       <div className="lg:hidden flex flex-col h-full bg-white relative">
          
          {/* 1. Sticky Top: Customer/Supplier Input */}
          <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-2 sticky top-0 z-20 shadow-sm">
              <UserIcon size={18} className="text-slate-400" />
              <input 
                 type="text"
                 className="flex-1 text-base outline-none text-slate-900 font-medium placeholder:text-slate-400 bg-transparent"
                 placeholder={mode === 'PURCHASE' ? "Supplier Name" : "Customer Name (Optional)"}
                 value={customerName}
                 onChange={e => setCustomerName(e.target.value)}
              />
              {cart.length > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold">{cart.length} Items</span>}
          </div>

          {/* 2. Scrollable Cart Area (Dense List) */}
          <div className="flex-1 overflow-y-auto pb-48"> 
              {cart.length === 0 ? (
                 <div className="flex flex-col items-center justify-center pt-20 text-slate-400 opacity-60">
                     <ShoppingCart size={48} className="mb-4 stroke-1" />
                     <p>Cart is empty</p>
                     <p className="text-xs">Tap '+ Add Item' below</p>
                 </div>
              ) : (
                 <div className="divide-y divide-slate-50">
                    {cart.map(item => (
                        <div key={item.tempId} className="px-4 py-3 bg-white flex justify-between items-center">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="font-bold text-base text-slate-900 truncate">{item.partNumber}</div>
                                <div className="text-xs text-slate-400">₹{item.price} each</div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                {/* Compact Qty Control */}
                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                    <button 
                                      onClick={() => item.quantity === 1 ? removeItem(item.tempId) : updateQty(item.tempId, -1)} 
                                      className="w-8 h-8 flex items-center justify-center text-slate-500 active:text-red-500 active:bg-red-50 rounded"
                                    >
                                       {item.quantity === 1 ? <Trash2 size={16}/> : <Minus size={16}/>}
                                    </button>
                                    <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                                    <button 
                                      onClick={() => updateQty(item.tempId, 1)} 
                                      className="w-8 h-8 flex items-center justify-center text-slate-900 active:bg-slate-200 rounded"
                                    >
                                       <Plus size={16}/>
                                    </button>
                                </div>
                                
                                <div className="w-16 text-right font-bold text-slate-900">
                                   ₹{item.price * item.quantity}
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
              )}
          </div>

          {/* 3. Fixed Bottom Action Stack (Above Bottom Nav) */}
          {/* Positioning: 'bottom-[60px]' clears the Bottom Nav Bar. z-40 ensures it's above content but below modals */}
          <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              
              {/* Full Width 'Add Item' Button */}
              <button 
                onClick={() => setShowMobileSearch(true)}
                className="w-full py-3 bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-100 transition-colors border-b border-blue-100"
              >
                 <PackagePlus size={18} />
                 + ADD ITEM
              </button>

              {/* Checkout Footer */}
              <div className="flex justify-between items-center p-3 pb-safe bg-white gap-3">
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Amount</span>
                      <span className={`text-xl font-black ${mode === 'RETURN' ? 'text-red-600' : 'text-slate-900'}`}>
                         {mode === 'RETURN' ? '-' : ''}₹{totalAmount.toLocaleString()}
                      </span>
                  </div>
                  
                  <button 
                     onClick={handleSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-1 py-3 px-6 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100 ${getAccentColor()}`}
                  >
                     {loading ? <Loader2 className="animate-spin" size={18} /> : (mode === 'RETURN' ? <Undo2 size={18}/> : <CheckCircle2 size={18}/>)}
                     {getButtonText()}
                  </button>
              </div>
          </div>

       </div>
    </div>
  );
};

export default DailyTransactions;