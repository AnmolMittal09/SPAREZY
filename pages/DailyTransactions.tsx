
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
  RefreshCw,
  Edit3,
  Percent,
  Tag,
  PlusCircle,
  Check
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
  name: string; 
  type: TransactionType;
  quantity: number;
  price: number; // Net Price after discount
  mrp: number;
  discount: number; // Percentage
  customerName: string;
}

const DailyTransactions: React.FC<Props> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  
  // UI States
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isManualAdd, setIsManualAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Manual Form State
  const [manualForm, setManualForm] = useState({ pn: '', name: '', mrp: '' });

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const inv = await fetchInventory();
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

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

  const addToCart = (item: Partial<StockItem>, isManual = false) => {
      const pn = item.partNumber || '';
      const existing = cart.find(c => c.partNumber.toUpperCase() === pn.toUpperCase());
      
      if (existing) {
          updateCartItem(existing.tempId, { quantity: existing.quantity + 1 });
          resetSearch();
          return;
      }

      const initialDiscount = mode === 'PURCHASE' ? 12 : 0;
      const mrpValue = item.price || 0;

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          partNumber: pn,
          name: item.name || 'Manual Part', 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          mrp: mrpValue,
          discount: initialDiscount,
          price: mrpValue * (1 - initialDiscount / 100),
          customerName: customerName
      };
      setCart(prev => [...prev, newItem]);
      resetSearch();
      setIsManualAdd(false);
      setManualForm({ pn: '', name: '', mrp: '' });
  };

  const resetSearch = () => {
    setSearch('');
    setSuggestions([]);
    setShowMobileSearch(false);
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              const updated = { ...item, ...updates };
              // Recalculate price if discount changed or vice versa
              if (updates.discount !== undefined) {
                  updated.price = updated.mrp * (1 - updates.discount / 100);
              } else if (updates.price !== undefined) {
                  updated.discount = updated.mrp > 0 ? ((updated.mrp - updated.price) / updated.mrp) * 100 : 0;
              }
              return updated;
          }
          return item;
      }));
  };

  const executeSubmit = async () => {
      if (cart.length === 0) return;
      setLoading(true);
      const res = await createBulkTransactions(cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Supplier' : 'Walk-in'),
          createdByRole: user.role
      })));
      setLoading(false);
      setShowConfirm(false);
      
      if (res.success) {
          setCart([]);
          setCustomerName('');
          loadData();
      } else alert("Error: " + res.message);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 h-full flex flex-col relative animate-fade-in overflow-hidden bg-slate-50">
       
       {/* MOBILE REFRESH HEADER */}
       <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-slate-100 lg:hidden shadow-sm">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-teal-500'}`}></div>
             <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{mode} MODE</span>
          </div>
          <button onClick={() => loadData(true)} className="p-2 text-slate-400"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
       </div>

       {/* CART AREA */}
       <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar pb-48">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Billing Information</p>
             <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                   type="text" 
                   className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500/10 outline-none"
                   placeholder={mode === 'PURCHASE' ? 'Supplier Name' : 'Customer Name'}
                   value={customerName}
                   onChange={e => setCustomerName(e.target.value)}
                />
             </div>
          </div>

          {cart.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner mb-4">
                   <ShoppingCart size={32} className="opacity-20" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Cart is empty</p>
             </div>
          ) : (
             cart.map(item => (
                <div 
                   key={item.tempId} 
                   onClick={() => setEditingItem(item)}
                   className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 animate-fade-in active:scale-[0.98] transition-all"
                >
                   <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                         <h4 className="font-black text-slate-900 leading-tight truncate uppercase">{item.partNumber}</h4>
                         <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{item.name}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-base font-black text-slate-900 tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</p>
                         <p className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 rounded inline-block">
                            {item.discount.toFixed(0)}% OFF
                         </p>
                      </div>
                   </div>
                   <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <Edit3 size={14} />
                         </div>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tap to Edit</span>
                      </div>
                      <div className="flex items-center gap-4">
                         <span className="text-sm font-black text-slate-900">QTY: {item.quantity}</span>
                         <div className="w-px h-4 bg-slate-100"></div>
                         <span className="text-sm font-black text-slate-900">₹{item.price.toLocaleString()}</span>
                      </div>
                   </div>
                </div>
             ))
          )}
       </div>

       {/* MOBILE FIXED FOOTER */}
       <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-5 shadow-elevated z-[100] pb-safe">
          <button 
             onClick={() => setShowMobileSearch(true)}
             className="w-full bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 mb-4 shadow-xl active:scale-95"
          >
             <PackagePlus size={20} /> Add Item
          </button>
          <div className="flex items-center justify-between">
             <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Grand Total</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums">₹{totalAmount.toLocaleString()}</p>
             </div>
             <button 
                onClick={() => setShowConfirm(true)}
                disabled={cart.length === 0 || loading}
                className={`px-8 py-4 rounded-xl font-black text-white shadow-xl transition-all active:scale-95 disabled:opacity-30 ${accentColor}`}
             >
                {loading ? <Loader2 className="animate-spin" size={20}/> : <div className="flex items-center gap-2">Finish <ArrowRight size={18}/></div>}
             </button>
          </div>
       </div>

       {/* SEARCH OVERLAY */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[1000] bg-slate-50 flex flex-col animate-slide-up">
            <div className="h-20 flex items-end px-5 pb-4 gap-4 bg-white border-b border-slate-200">
               <button onClick={() => { setShowMobileSearch(false); setIsManualAdd(false); }} className="p-2.5 text-slate-400 bg-slate-50 rounded-xl">
                  <ArrowLeft size={22} />
               </button>
               <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                     autoFocus
                     type="text" 
                     className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-xl border-none font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500/20"
                     placeholder="Search SKU..."
                     value={search}
                     onChange={e => handleSearch(e.target.value)}
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
                {isManualAdd ? (
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft space-y-4 animate-fade-in">
                      <h3 className="font-black text-slate-900 uppercase text-xs">New Manual Item</h3>
                      <div className="space-y-4">
                         <input 
                            className="w-full p-3 bg-slate-50 border rounded-xl font-bold uppercase text-sm" 
                            placeholder="Part Number" 
                            value={manualForm.pn}
                            onChange={e => setManualForm({...manualForm, pn: e.target.value})}
                         />
                         <input 
                            className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" 
                            placeholder="Part Name" 
                            value={manualForm.name}
                            onChange={e => setManualForm({...manualForm, name: e.target.value})}
                         />
                         <input 
                            type="number" 
                            className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" 
                            placeholder="MRP Price" 
                            value={manualForm.mrp}
                            onChange={e => setManualForm({...manualForm, mrp: e.target.value})}
                         />
                         <button 
                            onClick={() => addToCart({ partNumber: manualForm.pn, name: manualForm.name, price: parseFloat(manualForm.mrp) || 0 }, true)}
                            className="w-full py-4 bg-brand-600 text-white font-black rounded-xl"
                         >
                            Add to Cart
                         </button>
                      </div>
                   </div>
                ) : (
                   <>
                     {suggestions.length === 0 && search.length > 2 && (
                        <button 
                           onClick={() => { setIsManualAdd(true); setManualForm({...manualForm, pn: search}); }}
                           className="w-full bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-center gap-2 text-indigo-700 font-black text-xs uppercase"
                        >
                           <PlusCircle size={16} /> SKU not found? Add Manually
                        </button>
                     )}
                     {suggestions.map(item => (
                        <button 
                           key={item.id}
                           onClick={() => addToCart(item)}
                           className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center active:scale-[0.98]"
                        >
                           <div className="flex-1 min-w-0 pr-4 text-left">
                              <div className="flex items-center gap-2 mb-1">
                                 <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>{item.brand}</span>
                                 <div className="font-bold text-slate-900 truncate uppercase">{item.partNumber}</div>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">{item.name}</div>
                           </div>
                           <div className="text-right">
                              <div className="font-black text-slate-900">₹{item.price.toLocaleString()}</div>
                              <div className="text-[9px] font-bold text-slate-400">Stock: {formatQty(item.quantity)}</div>
                           </div>
                        </button>
                     ))}
                   </>
                )}
            </div>
         </div>
       )}

       {/* EDIT DRAWER (BOTTOM SHEET) */}
       {editingItem && (
          <div className="fixed inset-0 z-[2000] flex items-end animate-fade-in">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
             <div className="relative w-full bg-white rounded-t-[3rem] p-8 shadow-2xl animate-slide-up overflow-hidden">
                <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8"></div>
                <div className="flex justify-between items-start mb-8">
                   <div>
                      <h4 className="font-black text-slate-900 text-xl uppercase tracking-tight">{editingItem.partNumber}</h4>
                      <p className="text-slate-400 font-bold text-xs">MRP: ₹{editingItem.mrp.toLocaleString()}</p>
                   </div>
                   <button onClick={() => { setCart(prev => prev.filter(c => c.tempId !== editingItem.tempId)); setEditingItem(null); }} className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                      <Trash2 size={20} />
                   </button>
                </div>

                <div className="grid grid-cols-1 gap-6 mb-10">
                   {/* Quantity Edit */}
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Edit Quantity</p>
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100">
                         <button onClick={() => updateCartItem(editingItem.tempId, { quantity: Math.max(1, editingItem.quantity - 1) })} className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400"><Minus /></button>
                         <span className="text-3xl font-black text-slate-900">{editingItem.quantity}</span>
                         <button onClick={() => updateCartItem(editingItem.tempId, { quantity: editingItem.quantity + 1 })} className="w-14 h-14 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-center"><Plus /></button>
                      </div>
                   </div>

                   {/* Price/Discount Edit */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{mode === 'PURCHASE' ? 'B.DC %' : 'DISC %'}</p>
                         <div className="relative">
                            <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input 
                               type="number" 
                               inputMode="decimal"
                               className={`w-full pl-10 pr-4 py-4 bg-slate-50 rounded-2xl border font-black text-lg outline-none focus:ring-2 focus:ring-brand-500/20 ${mode === 'PURCHASE' && editingItem.discount < 12 ? 'border-rose-300' : 'border-slate-100'}`}
                               value={editingItem.discount}
                               onChange={e => updateCartItem(editingItem.tempId, { discount: parseFloat(e.target.value) || 0 })}
                            />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NET RATE</p>
                         <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input 
                               type="number" 
                               inputMode="decimal"
                               className="w-full pl-10 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 font-black text-lg outline-none focus:ring-2 focus:ring-brand-500/20"
                               value={editingItem.price}
                               onChange={e => updateCartItem(editingItem.tempId, { price: parseFloat(e.target.value) || 0 })}
                            />
                         </div>
                      </div>
                   </div>
                </div>

                <button onClick={() => setEditingItem(null)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3">
                   <Check size={20} /> Save Changes
                </button>
             </div>
          </div>
       )}

       <ConfirmModal 
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={executeSubmit}
          loading={loading}
          variant={mode === 'RETURN' ? 'danger' : 'primary'}
          title={`Process ${mode}`}
          message={`Final total is ₹${totalAmount.toLocaleString()}. Continue?`}
       />
    </div>
  );
};

export default DailyTransactions;
