import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Brand } from '../types';
import { createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { Search, Loader2, Trash2, Minus, Plus, ShoppingCart, User as UserIcon, PackagePlus, ArrowRight, Percent } from 'lucide-react';

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
  
  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       const filtered = inventory.filter(i => i.partNumber.toLowerCase().includes(val.toLowerCase()) || i.name.toLowerCase().includes(val.toLowerCase()));
       setSuggestions(filtered.slice(0, 10));
    } else setSuggestions([]);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) { updateQty(existing.tempId, 1); resetSearch(); return; }
      if (mode === 'SALES' && item.quantity === 0) return alert("Item out of stock!");

      const initialDiscount = mode === 'PURCHASE' ? 12 : 0;
      const initialPrice = mode === 'PURCHASE' ? item.price * (1 - initialDiscount / 100) : item.price;

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          partNumber: item.partNumber, name: item.name, 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1, mrp: item.price, discount: initialDiscount, price: initialPrice, customerName: customerName
      };
      setCart(prev => [...prev, newItem]);
      resetSearch();
  };

  const resetSearch = () => { setSearch(''); setSuggestions([]); };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = Math.max(1, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const handleSubmit = async () => {
      if (cart.length === 0) return;
      if (mode === 'SALES' && !customerName.trim()) return alert("Customer name required.");
      setLoading(true);
      const res = await createBulkTransactions(cart.map(c => ({ ...c, customerName, createdByRole: user.role })));
      setLoading(false);
      if (res.success) { alert("Transaction completed."); setCart([]); setCustomerName(''); fetchInventory().then(setInventory); }
      else alert("Error: " + res.message);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-24">
       <div className="lg:col-span-8 flex flex-col gap-6">
          {/* SEARCH BAR */}
          <div className="bg-white rounded-xl shadow-interface border border-slate-200 p-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" placeholder="Enter Part Number..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-xl text-lg font-bold focus:ring-2 focus:ring-brand-500/20"
                  value={search} onChange={e => handleSearch(e.target.value)}
                />
             </div>
             {suggestions.length > 0 && (
               <div className="mt-4 border-t pt-4 space-y-2">
                  {suggestions.map(s => (
                    <button 
                      key={s.id} onClick={() => addToCart(s)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-left transition-all"
                    >
                       <div>
                          <p className="font-bold text-slate-900 uppercase">{s.partNumber}</p>
                          <p className="text-xs text-slate-500">{s.name}</p>
                       </div>
                       <div className="text-right">
                          <p className="font-black">₹{s.price}</p>
                          <p className="text-[10px] uppercase font-black text-slate-400">In Stock: {s.quantity}</p>
                       </div>
                    </button>
                  ))}
               </div>
             )}
          </div>

          {/* CART VIEW */}
          <div className="bg-white rounded-xl shadow-interface border border-slate-200 flex-1 overflow-hidden flex flex-col">
             <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Basket Items</h3>
                <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded">{cart.length} PARTS</span>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar">
                {cart.map(item => (
                  <div key={item.tempId} className="p-4 border-b border-slate-100 flex items-center gap-6 group hover:bg-slate-50/50">
                     <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{item.partNumber}</p>
                        <p className="text-xs text-slate-500 truncate">{item.name}</p>
                     </div>
                     <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button onClick={() => updateQty(item.tempId, -1)} className="p-1 text-slate-400 hover:text-rose-500"><Minus size={16} /></button>
                        <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.tempId, 1)} className="p-1 text-slate-400 hover:text-teal-600"><Plus size={16} /></button>
                     </div>
                     <div className="text-right min-w-[80px]">
                        <p className="font-black text-slate-900 leading-none">₹{(item.price * item.quantity).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1">₹{item.price.toFixed(0)} NET</p>
                     </div>
                     <button onClick={() => setCart(c => c.filter(x => x.tempId !== item.tempId))} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </div>
                ))}
             </div>
          </div>
       </div>

       <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-panel border border-slate-200 p-6 space-y-6">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Profile</label>
                <div className="relative">
                   <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-lg font-bold"
                     placeholder="Client Name..." value={customerName} onChange={e => setCustomerName(e.target.value)}
                   />
                </div>
             </div>
             
             <div className="space-y-3 pt-6 border-t border-slate-100">
                <div className="flex justify-between text-slate-500 font-bold text-sm">
                   <span>Taxable Base</span>
                   <span>₹{(totalAmount * 0.82).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold text-sm">
                   <span>Estimated GST (18%)</span>
                   <span>₹{(totalAmount * 0.18).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                   <span className="font-black text-xs uppercase tracking-widest text-slate-400">Total Payable</span>
                   <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{totalAmount.toLocaleString()}</span>
                </div>
             </div>

             <button 
                onClick={handleSubmit} disabled={loading || cart.length === 0}
                className={`w-full py-4 rounded-xl text-white font-black flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all disabled:opacity-30 ${accentColor}`}
             >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><span className="uppercase tracking-widest">Finalize & Post</span> <ArrowRight size={20} /></>}
             </button>
          </div>
       </div>
    </div>
  );
};

export default DailyTransactions;