import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Brand } from '../types';
import { createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
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
  ArrowRight,
  Filter,
  PlusCircle
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
  mrp: number;
  discount: number;
  customerName: string;
}

const DailyTransactions: React.FC<Props> = ({ user, forcedMode }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       const filtered = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       );
       setSuggestions(filtered.slice(0, 15));
    } else {
       setSuggestions([]);
    }
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) {
          updateQty(existing.tempId, 1);
          resetSearch();
          return;
      }
      if (mode === 'SALES' && item.quantity === 0) return alert("Out of stock!");

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          mrp: item.price,
          discount: mode === 'PURCHASE' ? 12 : 0,
          price: mode === 'PURCHASE' ? item.price * 0.88 : item.price,
          customerName: customerName
      };
      setCart(prev => [...prev, newItem]);
      resetSearch();
  };

  const resetSearch = () => {
    setSearch('');
    setSuggestions([]);
    setShowMobileSearch(false);
  };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = Math.max(1, item.quantity + delta);
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
      if (mode === 'SALES' && !customerName.trim()) return alert("Customer Name required.");

      setLoading(true);
      const res = await createBulkTransactions(cart.map(c => ({ ...c, customerName, createdByRole: user.role })));
      setLoading(false);
      
      if (res.success) {
          alert("Success.");
          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else alert(res.message);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 flex flex-col animate-fade-in pb-40">
       
       {/* MOBILE SEARCH FULLSCREEN */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[100] bg-white flex flex-col safe-top animate-slide-in">
            <div className="h-14 flex items-center px-4 border-b border-slate-100 gap-3">
               <button onClick={() => setShowMobileSearch(false)} className="p-2 -ml-2 text-slate-900">
                  <ArrowLeft size={24} />
               </button>
               <input 
                  autoFocus
                  type="text" 
                  className="flex-1 bg-transparent text-base font-bold outline-none"
                  placeholder="Enter Part Number..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
               />
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 no-scrollbar">
                {suggestions.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="w-full bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center text-left active:bg-slate-50 transition-colors"
                    >
                        <div className="min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded text-white uppercase ${item.brand === Brand.HYUNDAI ? 'bg-hyundai' : 'bg-mahindra'}`}>
                                    {item.brand.substring(0,3)}
                                </span>
                                <span className="font-bold text-slate-900 text-sm">{item.partNumber}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-1">{item.name}</p>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-slate-900">₹{item.price}</div>
                            <div className="text-[10px] font-bold text-slate-400">Stock: {item.quantity}</div>
                        </div>
                    </button>
                ))}
            </div>
         </div>
       )}

       {/* MAIN CART UI */}
       <div className="flex flex-col gap-4">
          {mode === 'SALES' && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Context</p>
                <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                        type="text"
                        className="w-full bg-slate-50 pl-10 pr-4 py-3 rounded-xl border-none font-bold text-slate-900 focus:ring-2 focus:ring-brand-500/20 outline-none"
                        placeholder="Customer Name..."
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                    />
                </div>
            </div>
          )}

          <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Selected Parts ({cart.length})</p>
              
              {cart.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center opacity-50">
                     <ShoppingCart size={32} className="mx-auto text-slate-200 mb-2" />
                     <p className="text-xs font-bold text-slate-400 uppercase">Cart is empty</p>
                  </div>
              ) : (
                 cart.map(item => (
                    <div key={item.tempId} className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col gap-3">
                       <div className="flex justify-between items-start">
                           <div className="min-w-0 pr-4">
                              <div className="font-bold text-slate-900 text-sm leading-tight">{item.partNumber}</div>
                              <div className="text-[11px] text-slate-500 truncate">{item.name}</div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</div>
                              <div className="text-[9px] text-slate-400 uppercase font-black">Net ₹{item.price.toFixed(0)}</div>
                           </div>
                       </div>

                       <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                           <button onClick={() => removeItem(item.tempId)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={18} /></button>
                           <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl">
                               <button onClick={() => updateQty(item.tempId, -1)} className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Minus size={16} strokeWidth={3}/></button>
                               <span className="w-6 text-center font-bold text-base text-slate-900">{item.quantity}</span>
                               <button onClick={() => updateQty(item.tempId, 1)} className={`w-8 h-8 ${accentColor} text-white rounded-lg flex items-center justify-center active:scale-90 transition-all`}><Plus size={16} strokeWidth={3}/></button>
                           </div>
                       </div>
                    </div>
                 ))
              )}
          </div>
       </div>

       {/* STICKY FOOTER ACTIONS */}
       <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-[90] safe-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <button 
             onClick={() => setShowMobileSearch(true)}
             className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all text-sm uppercase tracking-widest shadow-lg"
          >
              <PackagePlus size={18} /> Add SKU
          </button>

          <div className="flex items-center gap-4">
              <div className="flex-1">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                 <p className="text-xl font-bold text-slate-900">₹{totalAmount.toLocaleString()}</p>
              </div>
              <button 
                 onClick={handleSubmit}
                 disabled={loading || cart.length === 0}
                 className={`flex-[1.5] text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 ${accentColor}`}
              >
                 {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <><span className="uppercase text-xs tracking-widest">Verify & Post</span> <ArrowRight size={18} /></>
                 )}
              </button>
          </div>
       </div>
    </div>
  );
};

export default DailyTransactions;