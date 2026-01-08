
import React, { useEffect, useState, useMemo } from 'react';
import { TransactionType, StockItem, Brand, TransactionStatus } from '../types';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { 
  Search,
  Loader2,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  PackagePlus,
  Percent,
  Sparkles,
  CircleSlash,
  X,
  Check,
  Box,
  ArrowRight,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const DailyTransactions: React.FC<any> = ({ user, forcedMode }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');

  const loadBaseData = async () => {
    const [inv] = await Promise.all([fetchInventory()]);
    setInventory(inv);
  };

  useEffect(() => { loadBaseData(); }, [mode]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       let filtered = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       );
       if (selectedBrand !== 'ALL') filtered = filtered.filter(i => i.brand === selectedBrand);
       setSuggestions(filtered.slice(0, 30));
    } else setSuggestions([]);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      if (existing) { 
          updateQty(existing.tempId, 1); 
          resetSearch(); 
          return; 
      }
      
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
          brand: item.brand,
          stockLevel: item.quantity
      };
      setCart(prev => [...prev, newItem]); 
      resetSearch();
  };

  const resetSearch = () => { setSearch(''); setSuggestions([]); };

  const updateQty = (id: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = Math.max(1, item.quantity + delta);
              if (mode === 'SALES' && newQty > item.stockLevel) newQty = item.stockLevel;
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const updateQtyDirect = (id: string, value: string) => {
      const val = parseInt(value) || 0;
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              let newQty = val;
              if (mode === 'SALES' && newQty > item.stockLevel) newQty = item.stockLevel;
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const updatePriceInfo = (id: string, field: 'mrp' | 'discount', value: string) => {
      const val = parseFloat(value) || 0;
      setCart(prev => prev.map(item => {
          if (item.tempId === id) {
              const updated = { ...item, [field]: val };
              updated.price = updated.mrp * (1 - updated.discount / 100);
              return updated;
          }
          return item;
      }));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    const payload = cart.map(item => ({
       partNumber: item.partNumber,
       type: mode as TransactionType,
       quantity: item.quantity,
       price: item.price,
       paidAmount: mode === 'SALES' ? 0 : (item.price * item.quantity),
       customerName: customerName || 'Walk-in',
       createdByRole: user.role,
       createdByName: user.name
    }));

    const res = await createBulkTransactions(payload);
    setLoading(false);
    if (res.success) {
      setCart([]);
      setCustomerName('');
      alert("Session committed successfully.");
    } else {
      alert("Failed to commit: " + res.message);
    }
  };

  const totalAmount = useMemo(() => cart.reduce((sum, item) => sum + (item.quantity * item.price), 0), [cart]);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-blue-600';

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-slate-50 font-['Plus_Jakarta_Sans']">
      
      {/* 1. Header Protocol Area */}
      <header className="flex-none p-4 md:p-6 bg-white border-b border-slate-200 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white shadow-lg ${accentColor}`}>
              <ShoppingCart size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-950 uppercase tracking-tighter leading-none">
                {mode} Processing
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                Unified Terminal • {user.role} Authority
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto no-scrollbar">
            {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
              <button 
                key={b} 
                onClick={() => setSelectedBrand(b)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedBrand === b ? 'bg-white text-slate-950 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 2. Unified Workspace Grid */}
      <main className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 h-full gap-0 xl:gap-px bg-slate-200 max-w-[1600px] mx-auto">
          
          {/* Left: SKU Scanner & Search */}
          <section className="xl:col-span-7 bg-slate-50 flex flex-col h-full overflow-hidden min-w-0">
            <div className="p-4 md:p-8 bg-white border-b border-slate-200 space-y-6">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" size={clamp(20, 32)} strokeWidth={3} />
                <input 
                  type="text" 
                  className="w-full pl-16 md:pl-20 pr-6 py-5 md:py-8 bg-slate-100 border-2 border-transparent rounded-[1.5rem] md:rounded-[2.5rem] text-xl md:text-3xl font-black text-slate-950 placeholder:text-slate-300 focus:bg-white focus:border-blue-600 outline-none transition-all uppercase tracking-tighter shadow-inner-soft"
                  placeholder="SCAN PART IDENTIFIER..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {search && (
                  <button onClick={resetSearch} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors">
                    <X size={18} className="text-slate-600" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-slate-50/50">
              {suggestions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {suggestions.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => addToCart(item)}
                      className="group/item text-left p-6 rounded-[2rem] border-2 border-slate-200 bg-white hover:border-blue-600 hover:shadow-elevated transition-all active:scale-[0.98] relative flex flex-col justify-between h-full"
                    >
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-black text-lg md:text-xl text-slate-950 tracking-tight uppercase leading-tight line-clamp-1">{item.partNumber}</span>
                          <span className={`flex-none px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${item.quantity > 0 ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                            {item.quantity > 0 ? 'INSTOCK' : 'OUT'}
                          </span>
                        </div>
                        <p className="text-[11px] md:text-[13px] text-slate-500 font-bold uppercase tracking-tight line-clamp-1">{item.name}</p>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ledger Qty: {fd(item.quantity)}</span>
                          <span className="font-black text-xl md:text-2xl text-slate-900 tracking-tighter tabular-nums">₹{item.price.toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg opacity-0 group-hover/item:opacity-100 transition-all translate-x-4 group-hover/item:translate-x-0">
                          <Plus size={20} strokeWidth={3} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-200">
                  {search.length > 0 ? (
                    <>
                      <CircleSlash size={80} strokeWidth={1} className="mb-6 opacity-20" />
                      <p className="font-black uppercase tracking-[0.4em] text-slate-400">Zero Matches Found</p>
                    </>
                  ) : (
                    <>
                      <PackagePlus size={100} strokeWidth={1} className="mb-6 opacity-10" />
                      <p className="font-black uppercase tracking-[0.5em] text-slate-300">Scanner Standby</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Input Sku to Begin Entry</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Right: Active Transaction Cart */}
          <section className="xl:col-span-5 bg-slate-950 flex flex-col h-full overflow-hidden border-t xl:border-t-0 border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] xl:shadow-none">
            
            {/* Cart Header */}
            <div className="p-6 md:p-10 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                  <ShoppingCart size={22} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Active Queue</h2>
              </div>
              <span className="bg-white/10 text-white px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/10">
                {fd(cart.length)} Assets Logged
              </span>
            </div>

            {/* Cart Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-slate-950">
              <div className="space-y-6">
                <div className="group">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-3 block ml-2">Transaction Entity</span>
                  <div className="relative">
                    <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-lg font-black text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-white/10 uppercase tracking-tight"
                      placeholder="Receiver/Source Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {cart.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30">
                      <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Queue Registry Empty</p>
                    </div>
                  ) : cart.map((item, idx) => (
                    <div key={item.tempId} className="p-6 bg-white/[0.03] border border-white/10 rounded-[2.5rem] space-y-6 animate-fade-in relative overflow-hidden group/cartitem">
                      <div className="absolute top-0 right-0 p-4 text-[40px] font-black text-white/[0.02] leading-none select-none">{fd(idx + 1)}</div>
                      
                      <div className="flex justify-between items-start relative">
                        <div className="min-w-0 pr-6">
                          <div className="flex items-center gap-2 mb-2">
                             <span className={`px-2 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-600' : 'bg-red-600'}`}>{item.brand.slice(0,3)}</span>
                             <h4 className="font-black text-white text-lg uppercase tracking-tight truncate leading-none">{item.partNumber}</h4>
                          </div>
                          <p className="text-[11px] text-white/40 font-bold uppercase tracking-tight truncate">{item.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-white tracking-tighter tabular-nums leading-none mb-1">₹{(item.price * item.quantity).toLocaleString()}</p>
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Net Realized</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 relative">
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Quantity</span>
                            {mode === 'SALES' && <span className="text-[8px] font-black text-teal-400 uppercase">Stock: {fd(item.stockLevel)}</span>}
                          </div>
                          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 shadow-inner">
                            <button onClick={() => updateQty(item.tempId, -1)} className="w-10 h-10 bg-white/10 text-white/40 rounded-xl flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><Minus size={16} strokeWidth={4}/></button>
                            <input 
                              type="number" 
                              className="w-full bg-transparent text-center font-black text-xl text-white outline-none tabular-nums px-1"
                              value={item.quantity}
                              onChange={(e) => updateQtyDirect(item.tempId, e.target.value)}
                            />
                            <button onClick={() => updateQty(item.tempId, 1)} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all shadow-lg"><Plus size={16} strokeWidth={4}/></button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">MRP Rate</span>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-xs font-black">₹</span>
                            <input 
                              type="number" 
                              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-3 py-3.5 text-lg font-black text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                              value={item.mrp}
                              onChange={(e) => updatePriceInfo(item.tempId, 'mrp', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-white/10">
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                           <Percent size={14} className="text-blue-500" strokeWidth={3} />
                           <input 
                              type="number" 
                              className="w-12 bg-transparent text-white font-black text-right outline-none text-sm"
                              value={item.discount}
                              onChange={(e) => updatePriceInfo(item.tempId, 'discount', e.target.value)}
                           />
                           <span className="text-xs font-black text-white/20">%</span>
                        </div>
                        <button onClick={() => setCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="p-3 text-white/10 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"><Trash2 size={20}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart Settlement Footer */}
            <footer className="p-6 md:p-10 border-t border-white/10 bg-black/40 backdrop-blur-md">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1.5 block">Aggregate Total</span>
                  <div className="flex items-center gap-3 text-teal-400 bg-teal-400/5 px-3 py-1 rounded-full border border-teal-400/10 w-fit">
                    <ShieldCheck size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Protocol Verified</span>
                  </div>
                </div>
                <p className="text-4xl md:text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
                  ₹{totalAmount.toLocaleString()}
                </p>
              </div>

              <button 
                onClick={handleSubmit} 
                disabled={cart.length === 0 || loading}
                className={`w-full py-6 md:py-8 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-white text-lg md:text-2xl shadow-2xl transition-all flex items-center justify-center gap-5 uppercase tracking-widest ${accentColor} border border-white/10 active:scale-[0.98] disabled:opacity-20 hover:brightness-110`}
              >
                {loading ? <Loader2 className="animate-spin" size={32} /> : <>Commit Session <ArrowRight size={32} strokeWidth={4} /></>}
              </button>
            </footer>
          </section>
        </div>
      </main>

      {/* Responsive Typography Logic */}
      <style>{`
        @function clamp($min, $max) {
          @return clamp(#{$min}px, 2vw, #{$max}px);
        }
      `}</style>
    </div>
  );
};

// CSS Clamp Helper for Runtime Injection if needed
const clamp = (min: number, max: number) => `clamp(${min}px, 4vw, ${max}px)`;

export default DailyTransactions;
