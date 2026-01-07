
import React, { useEffect, useState, useRef } from 'react';
import { Role, TransactionType, User, StockItem, Customer, Brand, TransactionStatus } from '../types';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { getCustomers } from '../services/masterService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  PackagePlus,
  ArrowLeft,
  ArrowRight,
  Percent,
  PlusSquare,
  Sparkles,
  Banknote,
  Wallet,
  CheckCircle2,
  CreditCard,
  CircleSlash,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const DailyTransactions: React.FC<any> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [pendingSalesMap, setPendingSalesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPaymentReceived, setIsPaymentReceived] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [isAddingNewSku, setIsAddingNewSku] = useState(false);
  const [newSkuForm, setNewSkuForm] = useState({ partNumber: '', name: '', mrp: '', brand: Brand.HYUNDAI });

  const loadBaseData = async () => {
    const [inv] = await Promise.all([fetchInventory()]);
    setInventory(inv);
    const pendingSales = await fetchTransactions(TransactionStatus.PENDING, TransactionType.SALE);
    const pMap: Record<string, number> = {};
    pendingSales.forEach(tx => { const pn = tx.partNumber.toLowerCase(); pMap[pn] = (pMap[pn] || 0) + tx.quantity; });
    setPendingSalesMap(pMap);
  };

  useEffect(() => { loadBaseData(); }, [mode]);
  useEffect(() => { if (onSearchToggle) onSearchToggle(showMobileSearch); }, [showMobileSearch, onSearchToggle]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       let filtered = inventory.filter(i => i.partNumber.toLowerCase().includes(val.toLowerCase()) || i.name.toLowerCase().includes(val.toLowerCase()));
       if (selectedBrand !== 'ALL') filtered = filtered.filter(i => i.brand === selectedBrand);
       setSuggestions(filtered.slice(0, 30));
    } else setSuggestions([]);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) { updateQty(existing.tempId, 1); resetSearch(); return; }
      const initialDiscount = mode === 'PURCHASE' ? (item.brand === Brand.MAHINDRA ? 19.36 : 12) : 0;
      const newItem = {
          tempId: Math.random().toString(36).substring(2),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode,
          quantity: 1,
          mrp: item.price,
          discount: initialDiscount,
          price: item.price * (1 - initialDiscount / 100),
          customerName: customerName,
          brand: item.brand
      };
      setCart(prev => [...prev, newItem]); resetSearch();
  };

  const resetSearch = () => { setSearch(''); setSuggestions([]); setShowMobileSearch(false); };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => item.tempId === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const updateDiscount = (id: string, newDiscount: number) => {
    setCart(prev => prev.map(item => item.tempId === id ? { ...item, discount: newDiscount, price: item.mrp * (1 - newDiscount / 100) } : item));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-700' : mode === 'PURCHASE' ? 'bg-slate-950' : 'bg-blue-700';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in overflow-hidden">
       {isAddingNewSku && (
         <div className="fixed inset-0 z-[1100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border-4 border-slate-900 p-10 animate-slide-up">
                <div className="flex items-center gap-5 mb-8">
                    <div className="p-4 bg-blue-100 text-blue-900 rounded-2xl shadow-inner"><Sparkles size={28} strokeWidth={3} /></div>
                    <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter">New Entry</h3>
                </div>
                <div className="space-y-5">
                    <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">Part ID (SKU)</label><input type="text" className="w-full bg-slate-100 p-5 rounded-2xl border-2 border-transparent focus:border-slate-950 outline-none font-black text-slate-950 uppercase text-lg" value={newSkuForm.partNumber} onChange={e => setNewSkuForm({...newSkuForm, partNumber: e.target.value})}/></div>
                    <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">Description</label><input type="text" className="w-full bg-slate-100 p-5 rounded-2xl border-2 border-transparent focus:border-slate-950 outline-none font-bold text-slate-950 uppercase" value={newSkuForm.name} onChange={e => setNewSkuForm({...newSkuForm, name: e.target.value})}/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">Brand</label><select className="w-full bg-slate-100 p-5 rounded-2xl font-black text-slate-950 uppercase appearance-none" value={newSkuForm.brand} onChange={e => setNewSkuForm({...newSkuForm, brand: e.target.value as Brand})}><option value={Brand.HYUNDAI}>HYUNDAI</option><option value={Brand.MAHINDRA}>MAHINDRA</option></select></div>
                        <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">MRP Rate</label><input type="number" className="w-full bg-slate-100 p-5 rounded-2xl font-black text-slate-950 text-lg" value={newSkuForm.mrp} onChange={e => setNewSkuForm({...newSkuForm, mrp: e.target.value})}/></div>
                    </div>
                </div>
                <div className="flex gap-4 mt-10"><button onClick={() => setIsAddingNewSku(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-900 font-extrabold rounded-2xl hover:bg-slate-50 uppercase text-xs">Cancel</button><button onClick={() => alert('Logic...')} className="flex-[2] py-4 bg-slate-950 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest">Commit Registry</button></div>
            </div>
         </div>
       )}

       <div className="hidden lg:grid grid-cols-12 gap-8 h-full p-2">
           <div className="col-span-7 bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 flex flex-col overflow-hidden">
               <div className="p-8 border-b-2 border-slate-100 bg-slate-50 space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex bg-slate-200 p-1.5 rounded-2xl border-2 border-slate-300 w-fit">
                          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                             <button key={b} onClick={() => setSelectedBrand(b)} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedBrand === b ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-700 hover:text-slate-950'}`}>{b}</button>
                          ))}
                      </div>
                      {mode === 'PURCHASE' && <div className="bg-slate-950 text-white px-5 py-3 rounded-xl flex items-center gap-3 font-black text-[11px] uppercase tracking-[0.15em]"><Percent size={14} /> Auto-Rules Active</div>}
                   </div>
                   <div className="relative">
                       <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900" size={32} strokeWidth={3} />
                       <input type="text" className="w-full pl-18 pr-6 py-6 bg-white border-2 border-slate-200 rounded-[2.5rem] text-3xl font-black text-slate-950 placeholder:text-slate-300 focus:border-slate-950 outline-none transition-all uppercase tracking-tighter" placeholder="SCAN PART IDENTIFIER..." value={search} onChange={e => handleSearch(e.target.value)}/>
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50/20">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-5">
                         {suggestions.map(item => (
                            <button key={item.id} onClick={() => addToCart(item)} className="group/btn text-left p-6 rounded-[2.5rem] border-2 border-slate-200 bg-white hover:border-slate-950 hover:shadow-elevated transition-all active:scale-[0.98]">
                                <div className="flex justify-between items-start mb-3"><span className="font-black text-xl text-slate-950 tracking-tighter uppercase leading-none">{item.partNumber}</span><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 ${item.quantity > 0 ? 'bg-teal-700 text-white border-teal-800' : 'bg-rose-700 text-white border-rose-800'}`}>{item.quantity > 0 ? 'AVL' : 'OUT'}</span></div>
                                <div className="text-[13px] text-slate-700 font-extrabold truncate mb-5 uppercase tracking-tight">{item.name}</div>
                                <div className="flex justify-between items-center"><div className="font-black text-2xl text-slate-950 tracking-tighter tabular-nums">₹{item.price.toLocaleString()}</div><div className="p-3 bg-slate-950 text-white rounded-2xl shadow-lg opacity-0 group-hover/btn:opacity-100 transition-all"><Plus size={18} strokeWidth={4}/></div></div>
                            </button>
                         ))}
                      </div>
                  ) : <div className="flex flex-col items-center justify-center h-full text-slate-300"><PackagePlus size={80} strokeWidth={2.5} className="mb-6 opacity-20" /><p className="font-black text-slate-400 uppercase tracking-[0.4em] text-sm">Protocol Scanner Idle</p></div>}
               </div>
           </div>

           <div className="col-span-5 bg-slate-950 rounded-[3rem] shadow-elevated flex flex-col overflow-hidden text-white border-2 border-slate-900">
                <div className="p-10 border-b-2 border-white/5 flex justify-between items-center">
                    <h2 className="font-black text-2xl tracking-tighter flex items-center gap-4 uppercase"><ShoppingCart size={28} strokeWidth={3} className="text-blue-500" /> Current Cart</h2>
                    <span className="bg-white text-slate-950 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest">{fd(cart.length)} Assets</span>
                </div>

                <div className="p-10 space-y-8">
                    <div>
                        <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.25em] mb-4 block ml-1">Entity Reference</span>
                        <input type="text" className="w-full px-8 py-5 bg-white/5 border-2 border-white/10 rounded-3xl text-xl font-black text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-white/20 uppercase tracking-tight" placeholder="Verified Receiver Name" value={customerName} onChange={e => setCustomerName(e.target.value)}/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className="p-6 rounded-[2.5rem] border-2 border-white/5 bg-white/[0.03] flex flex-col gap-5 animate-fade-in hover:bg-white/10 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4 flex-1">
                                    <div className="flex items-center gap-2 mb-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded text-white tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.slice(0,3)}</span><div className="font-black text-white text-xl tracking-tight uppercase leading-none">{item.partNumber}</div></div>
                                    <div className="text-[12px] text-white/60 font-bold uppercase truncate tracking-tight">{item.name}</div>
                                </div>
                                <div className="text-right"><div className="font-black text-white text-2xl tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</div></div>
                            </div>
                            <div className="flex items-center gap-4 pt-5 border-t-2 border-white/5">
                                <div className="flex items-center bg-white/10 p-1.5 rounded-2xl border-2 border-white/5"><button onClick={() => updateQty(item.tempId, -1)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><Minus size={18} strokeWidth={4}/></button><span className="w-14 text-center font-black text-xl text-white tabular-nums">{fd(item.quantity)}</span><button onClick={() => updateQty(item.tempId, 1)} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all"><Plus size={18} strokeWidth={4}/></button></div>
                                <div className="flex-1 flex items-center gap-3 bg-white/10 p-3 px-5 rounded-2xl border-2 border-white/5"><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Rate</span><input type="number" className="w-full bg-transparent text-white font-black text-right text-lg outline-none" value={item.price} readOnly/></div>
                                <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="text-white/20 hover:text-rose-500 p-3 rounded-2xl transition-all"><Trash2 size={24} strokeWidth={2.5}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-10 border-t-4 border-slate-900 bg-black/40">
                    <div className="flex justify-between items-end mb-8"><div className="flex flex-col"><span className="text-white/40 font-black uppercase tracking-[0.3em] text-[11px]">Aggregate Net Total</span><p className="text-[11px] font-bold text-teal-400 uppercase tracking-widest mt-1">Validated Transaction Value</p></div><span className="text-5xl font-black text-white tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</span></div>
                    <button onClick={() => alert('Submitting...')} disabled={cart.length === 0} className={`w-full py-7 rounded-[2rem] font-black text-white text-xl shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-5 uppercase tracking-widest ${accentColor} border-2 border-white/10`}>{loading ? <Loader2 className="animate-spin" size={28} /> : <>Commit Session <ArrowRight size={28} strokeWidth={4} /></>}</button>
                </div>
           </div>
       </div>
    </div>
  );
};

export default DailyTransactions;
