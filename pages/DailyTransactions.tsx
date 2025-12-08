


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
  CheckCircle2
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
          return;
      }
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
                      if (delta > 0) {
                          alert(`Stock Limit Reached: Only ${maxStock} units of ${item.partNumber} available.`);
                      }
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
            // Owner flow
            alert("Transaction confirmed and stock updated.");
          }

          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory);
      } else {
          alert("Error: " + res.message);
      }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
       <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-slate-100 bg-slate-50">
               <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     type="text" 
                     placeholder="Search item..."
                     className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm text-lg"
                     value={search}
                     onChange={e => handleSearch(e.target.value)}
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
                          className="text-left p-4 rounded-lg border bg-white border-slate-200 hover:border-primary-300"
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

       <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800">
                    {mode === 'SALES' ? 'Sale Items' : 'Purchase List'}
                    <span className="ml-2 bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{cart.length}</span>
                </h2>
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-600 hover:underline">Clear</button>}
            </div>

            <div className="p-4 border-b border-slate-100">
                <input 
                   type="text" 
                   className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary-500"
                   placeholder={mode === 'PURCHASE' ? "Supplier Name" : "Customer Name (Optional)"}
                   value={customerName}
                   onChange={e => setCustomerName(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cart.map(item => (
                    <div key={item.tempId} className="p-3 rounded-lg border border-slate-100 bg-white flex gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800">{item.partNumber}</div>
                            <div className="text-xs text-slate-500">₹{item.price} x {item.quantity}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="font-bold text-sm text-slate-900">₹{item.price * item.quantity}</div>
                            <div className="flex items-center gap-1 bg-slate-100 rounded p-0.5">
                                <button onClick={() => updateQty(item.tempId, -1)} className="p-0.5 hover:bg-white rounded"><Minus size={12}/></button>
                                <span className="text-xs w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQty(item.tempId, 1)} className="p-0.5 hover:bg-white rounded"><Plus size={12}/></button>
                            </div>
                        </div>
                        <button onClick={() => removeItem(item.tempId)} className="text-slate-300 hover:text-red-500 self-start"><Trash2 size={14}/></button>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-medium">Total</span>
                    <span className="text-xl font-bold text-slate-900">₹{totalAmount.toLocaleString()}</span>
                </div>
                <button 
                   onClick={handleSubmit}
                   disabled={loading || cart.length === 0}
                   className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 shadow-md transition-all disabled:opacity-50"
                >
                   {loading ? <Loader2 className="animate-spin" size={20} /> : (
                      user.role === Role.MANAGER ? <Send size={20} /> : (mode === 'SALES' ? <Save size={20} /> : <CheckCircle2 size={20} />)
                   )}
                   {user.role === Role.MANAGER ? 'Submit for Approval' : (mode === 'SALES' ? 'Record Sale' : 'Confirm Purchase')}
                </button>
            </div>
       </div>
    </div>
  );
};

export default DailyTransactions;
