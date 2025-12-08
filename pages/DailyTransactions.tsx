
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
  Send,
  Save,
  CheckCircle2,
  Undo2,
  ShoppingCart,
  X,
  ArrowRight,
  ChevronUp
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
       ).slice(0, 10);
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
                      // Don't alert aggressively on every click, just clamp
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
     return 'Sale';
  };

  const getThemeColor = () => {
      if (mode === 'RETURN') return 'text-red-900 border-red-200 bg-red-50';
      if (mode === 'PURCHASE') return 'text-blue-900 border-blue-200 bg-blue-50';
      return 'text-slate-800 border-slate-200 bg-white';
  };

  return (
    <div className="flex-1 h-full min-h-0 relative">
       
       {/* --- MOBILE: FULL SCREEN SEARCH MODAL --- */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in lg:hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
               <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     autoFocus
                     type="text" 
                     placeholder="Search item..."
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-lg focus:ring-2 focus:ring-primary-500 outline-none"
                     value={search}
                     onChange={e => handleSearch(e.target.value)}
                   />
               </div>
               <button onClick={() => setShowMobileSearch(false)} className="p-3 bg-slate-100 rounded-xl text-slate-600">
                  <X size={20} />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {suggestions.map(item => (
                    <button 
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="w-full text-left p-4 mb-3 rounded-xl border border-slate-100 shadow-sm bg-white active:bg-slate-50"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-lg text-slate-900">{item.partNumber}</span>
                            <span className={`text-xs px-2 py-1 rounded font-bold ${item.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                Stock: {item.quantity}
                            </span>
                        </div>
                        <div className="text-sm text-slate-500 mb-2">{item.name}</div>
                        <div className="font-bold text-blue-600 text-lg">₹{item.price}</div>
                    </button>
                ))}
                {suggestions.length === 0 && search.length > 1 && (
                    <div className="text-center text-slate-400 mt-10">No items found.</div>
                )}
            </div>
         </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
           
           {/* --- LEFT COLUMN: SEARCH & SUGGESTIONS (Desktop Only) --- */}
           <div className="hidden lg:flex lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex-col overflow-hidden">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

           {/* --- RIGHT COLUMN: CART (Mobile & Desktop) --- */}
           <div className="lg:col-span-1 bg-white lg:rounded-xl lg:shadow-sm lg:border border-slate-200 flex flex-col h-full overflow-hidden absolute inset-0 lg:static z-0">
                {/* Mobile Header */}
                <div className={`p-4 border-b flex justify-between items-center bg-white border-slate-100 sticky top-0 z-10`}>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <ShoppingCart size={20} className="text-slate-400" />
                        {mode === 'SALES' ? 'Current Sale' : mode === 'RETURN' ? 'Returns' : 'Purchase Order'}
                    </h2>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg">Clear All</button>}
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

                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 lg:pb-4">
                    {/* Add Item Button (Mobile Only) */}
                    <button 
                      onClick={() => setShowMobileSearch(true)}
                      className="lg:hidden w-full py-4 border-2 border-dashed border-blue-200 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
                    >
                       <Plus size={20} /> Add Item
                    </button>

                    {cart.length === 0 && (
                       <div className="text-center text-slate-400 py-10 text-sm italic">
                          Cart is empty. Add items to start.
                       </div>
                    )}

                    {cart.map(item => (
                        <div key={item.tempId} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-800 text-lg">{item.partNumber}</div>
                                    <div className="text-sm text-slate-500">Unit: ₹{item.price}</div>
                                </div>
                                <div className={`font-bold text-lg ${mode === 'RETURN' ? 'text-red-600' : 'text-slate-900'}`}>
                                    {mode === 'RETURN' ? '-' : ''}₹{item.price * item.quantity}
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                <button onClick={() => removeItem(item.tempId)} className="text-red-400 hover:text-red-600 p-2">
                                    <Trash2 size={18}/>
                                </button>
                                
                                <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => updateQty(item.tempId, -1)} className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
                                        <Minus size={18}/>
                                    </button>
                                    <span className="font-bold text-lg w-8 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.tempId, 1)} className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
                                        <Plus size={18}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 lg:static shadow-[0_-4px_10px_rgba(0,0,0,0.05)] lg:shadow-none pb-safe lg:pb-4 z-20">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-500 font-medium text-lg">
                            Total
                        </span>
                        <span className={`text-2xl font-black ${mode === 'RETURN' ? 'text-red-600' : 'text-slate-900'}`}>
                            {mode === 'RETURN' ? '-' : ''}₹{totalAmount.toLocaleString()}
                        </span>
                    </div>
                    <button 
                       onClick={handleSubmit}
                       disabled={loading || cart.length === 0}
                       className={`w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 ${
                          mode === 'RETURN' ? 'bg-red-600 shadow-red-200' : 'bg-slate-900 shadow-slate-200'
                       }`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={24} /> : (mode === 'RETURN' ? <Undo2 size={24}/> : <CheckCircle2 size={24}/>)}
                       {getButtonText()} {cart.length > 0 ? `(${cart.length})` : ''}
                    </button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default DailyTransactions;
