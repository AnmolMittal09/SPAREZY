import React, { useEffect, useState, useRef } from 'react';
import { Role, Transaction, TransactionStatus, TransactionType, User, StockItem } from '../types';
import { 
  createBulkTransactions, 
  fetchTransactions, 
  fetchAnalytics,
  fetchSalesForReturn,
} from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { generateInvoice } from '../services/invoiceService';
import { 
  ShoppingCart, 
  Truck, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  Search,
  Loader2,
  Trash2,
  Printer,
  RotateCcw,
  IndianRupee,
  Minus,
  Plus,
  ArrowRight
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

interface CartItem {
  tempId: string;
  partNumber: string;
  type: TransactionType;
  quantity: number;
  price: number;
  customerName: string;
  stockError?: boolean;
  relatedTransactionId?: string;
}

const DailyTransactions: React.FC<Props> = ({ user }) => {
  // Mode Selection
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>('SALES');
  
  // Data State
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  
  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

  useEffect(() => {
    // Clear cart when switching modes to prevent type mixing
    setCart([]);
    setSearch('');
    setSuggestions([]);
    setCustomerName('');
  }, [mode]);

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
      // Check duplicate
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) {
          updateQty(existing.tempId, 1);
          setSearch('');
          setSuggestions([]);
          return;
      }

      // Sales Stock Check
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
              const newQty = Math.max(1, item.quantity + delta);
              
              // Validate Stock for Sales
              if (mode === 'SALES') {
                  const stockItem = inventory.find(i => i.partNumber === item.partNumber);
                  if (stockItem && newQty > stockItem.quantity) {
                      return { ...item, stockError: true, quantity: newQty };
                  }
                  return { ...item, stockError: false, quantity: newQty };
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
          alert("Please fix stock errors before proceeding.");
          return;
      }
      if (!customerName && mode !== 'SALES') {
           // Maybe require Supplier name for purchases?
      }

      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || 'Walk-in',
          createdByRole: user.role
      }));

      setLoading(true);
      const res = await createBulkTransactions(payload);
      setLoading(false);

      if (res.success) {
          if (mode === 'SALES' && user.role === Role.OWNER) {
             generateInvoice(payload, inventory);
          }
          alert("Transaction recorded successfully!");
          setCart([]);
          setCustomerName('');
          fetchInventory().then(setInventory); // Refresh stock
      } else {
          alert("Error: " + res.message);
      }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
       
       {/* Top Controls */}
       <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Billing & Operations</h1>
            <p className="text-slate-500">Create invoices or record new purchases.</p>
          </div>
          
          <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex">
             <button 
               onClick={() => setMode('SALES')}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'SALES' ? 'bg-primary-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <ShoppingCart size={16} className="inline mr-2" /> New Invoice
             </button>
             <button 
               onClick={() => setMode('PURCHASE')}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'PURCHASE' ? 'bg-blue-800 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Truck size={16} className="inline mr-2" /> Purchase Entry
             </button>
             <button 
               onClick={() => setMode('RETURN')}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'RETURN' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <RotateCcw size={16} className="inline mr-2" /> Returns
             </button>
          </div>
       </div>

       {/* Main Workspace */}
       <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
           
           {/* LEFT: Item Selector */}
           <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                   <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                         type="text" 
                         autoFocus
                         placeholder="Scan barcode or type part number/name..."
                         className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm text-lg"
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                       />
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4">
                  {search && suggestions.length === 0 && (
                      <div className="text-center text-slate-400 py-10">No parts found matching "{search}"</div>
                  )}
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {suggestions.map(item => {
                            const isStockLow = item.quantity === 0;
                            return (
                                <button 
                                  key={item.id}
                                  onClick={() => addToCart(item)}
                                  className={`text-left p-4 rounded-lg border transition-all hover:shadow-md ${isStockLow && mode === 'SALES' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-primary-300'}`}
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
                            );
                         })}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <Search size={48} className="mb-4 opacity-20" />
                          <p>Start typing to search inventory</p>
                      </div>
                  )}
               </div>
           </div>

           {/* RIGHT: Invoice / Cart */}
           <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        {mode === 'SALES' ? 'Current Bill' : mode === 'PURCHASE' ? 'Purchase Order' : 'Return List'}
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{cart.length}</span>
                    </h2>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-600 hover:underline">Clear</button>}
                </div>

                <div className="p-4 border-b border-slate-100">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
                        {mode === 'PURCHASE' ? 'Supplier Name' : 'Customer Name'}
                    </label>
                    <input 
                       type="text" 
                       className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                       placeholder={mode === 'PURCHASE' ? "e.g. Metro Spares Ltd" : "e.g. Walk-in Customer"}
                       value={customerName}
                       onChange={e => setCustomerName(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cart.map(item => (
                        <div key={item.tempId} className={`p-3 rounded-lg border flex gap-3 ${item.stockError ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800">{item.partNumber}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                   ₹{item.price} x {item.quantity}
                                   {item.stockError && <span className="text-red-600 font-bold ml-1">(!Stock)</span>}
                                </div>
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
                        <span className="text-slate-500 font-medium">Total Amount</span>
                        <span className="text-xl font-bold text-slate-900">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={handleSubmit}
                       disabled={loading || cart.length === 0}
                       className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${
                           mode === 'SALES' ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-200' : 
                           mode === 'PURCHASE' ? 'bg-blue-800 hover:bg-blue-900' : 
                           'bg-red-600 hover:bg-red-700'
                       } disabled:opacity-50 disabled:shadow-none`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={20} /> : (
                           <>
                             {mode === 'SALES' ? <Printer size={20} /> : <CheckCircle2 size={20} />}
                             {mode === 'SALES' ? 'Print Invoice' : 'Confirm Order'}
                           </>
                       )}
                    </button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default DailyTransactions;