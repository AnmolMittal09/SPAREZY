
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
  User as UserIcon,
  PackagePlus,
  ArrowLeft,
  X,
  ArrowRight,
  Filter,
  Activity,
  Box,
  Percent,
  Calculator,
  Lock,
  History,
  PlusSquare,
  Tag,
  Layers,
  Sparkles
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

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
  stockError?: boolean;
  isNewSku?: boolean; 
  brand?: Brand;
}

const DailyTransactions: React.FC<Props> = ({ user, forcedMode, onSearchToggle }) => {
  const [mode, setMode] = useState<'SALES' | 'PURCHASE' | 'RETURN'>(forcedMode || 'SALES');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [pendingSalesMap, setPendingSalesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // New SKU State
  const [isAddingNewSku, setIsAddingNewSku] = useState(false);
  const [newSkuForm, setNewSkuForm] = useState({
      partNumber: '',
      name: '',
      mrp: '',
      brand: Brand.HYUNDAI
  });

  useEffect(() => {
    loadBaseData();
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowCustomerList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  const loadBaseData = async () => {
    const [inv, customers] = await Promise.all([
      fetchInventory(),
      mode === 'SALES' ? getCustomers() : Promise.resolve([])
    ]);
    setInventory(inv);
    if (Array.isArray(customers)) setSavedCustomers(customers);

    const pendingSales = await fetchTransactions(TransactionStatus.PENDING, TransactionType.SALE);
    const pMap: Record<string, number> = {};
    pendingSales.forEach(tx => {
      const pn = tx.partNumber.toLowerCase();
      pMap[pn] = (pMap[pn] || 0) + tx.quantity;
    });
    setPendingSalesMap(pMap);
  };

  useEffect(() => { if (forcedMode) setMode(forcedMode); }, [forcedMode]);

  useEffect(() => {
    if (onSearchToggle) onSearchToggle(showMobileSearch);
  }, [showMobileSearch, onSearchToggle]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.length > 0) {
       let filtered = inventory.filter(i => 
         i.partNumber.toLowerCase().includes(val.toLowerCase()) || 
         i.name.toLowerCase().includes(val.toLowerCase())
       );
       if (selectedBrand !== 'ALL') filtered = filtered.filter(i => i.brand === selectedBrand);
       setSuggestions(filtered.slice(0, 30));
    } else {
       setSuggestions([]);
    }
  };

  const handleCustomerType = (val: string) => {
    setCustomerName(val);
    if (mode === 'SALES' && val.length > 0) {
      const lowerVal = val.toLowerCase();
      setCustomerSuggestions(savedCustomers.filter(c => 
        (c.name?.toLowerCase().includes(lowerVal)) || (c.phone?.includes(val))
      ).slice(0, 5));
      setShowCustomerList(true);
    } else setShowCustomerList(false);
  };

  const getAvailableStock = (item: StockItem) => {
    const pending = pendingSalesMap[item.partNumber.toLowerCase()] || 0;
    return Math.max(0, item.quantity - pending);
  };

  const addToCart = (item: StockItem) => {
      const existing = cart.find(c => c.partNumber === item.partNumber);
      const available = getAvailableStock(item);

      if (existing) {
          if (mode === 'SALES' && existing.quantity + 1 > available) {
            alert(`Insufficient stock. Available: ${fd(available)}`);
            return;
          }
          updateQty(existing.tempId, 1);
          resetSearch();
          return;
      }

      if (mode === 'SALES' && available === 0) return alert("Item out of stock!");

      const initialDiscount = mode === 'PURCHASE' ? 12 : 0;
      const initialPrice = item.price * (1 - initialDiscount / 100);

      const newItem: CartItem = {
          tempId: Math.random().toString(36).substring(2),
          partNumber: item.partNumber,
          name: item.name, 
          type: mode === 'SALES' ? TransactionType.SALE : mode === 'PURCHASE' ? TransactionType.PURCHASE : TransactionType.RETURN,
          quantity: 1,
          mrp: item.price,
          discount: initialDiscount,
          price: initialPrice,
          customerName: customerName,
          stockError: false
      };
      setCart(prev => [...prev, newItem]);
      resetSearch();
  };

  const openNewSkuModal = () => {
      setNewSkuForm({
          ...newSkuForm,
          partNumber: search.toUpperCase(),
          brand: search.toUpperCase().startsWith('MH') ? Brand.MAHINDRA : Brand.HYUNDAI
      });
      setIsAddingNewSku(true);
  };

  const confirmAddNewSku = () => {
      if (!newSkuForm.partNumber || !newSkuForm.name || !newSkuForm.mrp) {
          return alert("All fields are mandatory for new SKU initialization.");
      }

      const mrpValue = parseFloat(newSkuForm.mrp);
      if (isNaN(mrpValue)) return alert("Invalid MRP amount.");

      const initialDiscount = 12;
      const initialPrice = mrpValue * (1 - initialDiscount / 100);

      const newItem: CartItem = {
          tempId: Math.random().toString(36).substring(2),
          partNumber: newSkuForm.partNumber.toUpperCase().trim(),
          name: newSkuForm.name.toUpperCase(),
          type: TransactionType.PURCHASE,
          quantity: 1,
          mrp: mrpValue,
          discount: initialDiscount,
          price: initialPrice,
          customerName: customerName || 'Direct Acquisition',
          isNewSku: true,
          brand: newSkuForm.brand
      };

      setCart(prev => [...prev, newItem]);
      setIsAddingNewSku(false);
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
              let newQty = item.quantity + delta;
              if (newQty < 1) newQty = 1;
              if (mode === 'SALES') {
                  const stockItem = inventory.find(i => i.partNumber === item.partNumber);
                  if (stockItem) {
                    const available = getAvailableStock(stockItem);
                    if (newQty > available) newQty = available;
                  }
              }
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const setQtyDirect = (id: string, val: number) => {
    setCart(prev => prev.map(item => {
      if (item.tempId === id) {
        let newQty = Math.max(1, val);
        if (mode === 'SALES') {
          const stockItem = inventory.find(i => i.partNumber === item.partNumber);
          if (stockItem) {
            const available = getAvailableStock(stockItem);
            if (newQty > available) newQty = available;
          }
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateDiscount = (id: string, newDiscount: number) => {
    setCart(prev => prev.map(item => {
      if (item.tempId === id) {
        const disc = Math.max(0, Math.min(100, newDiscount));
        return { 
          ...item, 
          discount: disc,
          price: item.mrp * (1 - disc / 100)
        };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.tempId !== id));
  };

  const executeSubmit = async () => {
      setLoading(true);
      
      // 1. Process New SKUs first
      const newItems = cart.filter(c => c.isNewSku);
      if (newItems.length > 0) {
          const payload = newItems.map(c => ({
              partNumber: c.partNumber,
              name: c.name,
              price: c.mrp,
              brand: c.brand,
              quantity: 0 
          }));
          await updateOrAddItems(payload);
      }

      // 2. Transmit all ledger entries
      const payload = cart.map(c => ({
          ...c,
          customerName: customerName || (mode === 'PURCHASE' ? 'Standard Supplier' : 'Walk-in'),
          createdByRole: user.role
      }));
      
      const res = await createBulkTransactions(payload);
      setLoading(false);
      setShowConfirm(false);
      
      if (res.success) {
          alert(user.role === Role.MANAGER ? "Sent to owner for verification." : "Stock updated and requisitions fulfilled.");
          setCart([]);
          setCustomerName('');
          loadBaseData();
      } else alert("Error: " + res.message);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const accentColor = mode === 'RETURN' ? 'bg-rose-600' : mode === 'PURCHASE' ? 'bg-slate-900' : 'bg-brand-600';

  return (
    <div className="flex-1 h-full flex flex-col animate-fade-in overflow-hidden">
       
       {/* RE-USABLE NEW SKU MODAL (MOBILE & DESKTOP) */}
       {isAddingNewSku && (
         <div className="fixed inset-0 z-[1100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-slide-up">
                <div className="p-8 pb-4">
                    <div className="flex items-center gap-5 mb-8">
                        <div className="p-3.5 bg-blue-50 text-blue-600 rounded-[1.25rem] shadow-inner">
                            <Sparkles size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Initialize SKU</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Direct Database Injection</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="relative group">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Part Identifier (PN)</label>
                            <input 
                                type="text"
                                className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-blue-500/5 transition-all uppercase shadow-inner-soft"
                                value={newSkuForm.partNumber}
                                onChange={e => setNewSkuForm({...newSkuForm, partNumber: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Official Description</label>
                            <input 
                                type="text"
                                placeholder="e.g. OIL FILTER GENUINE"
                                className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-blue-500/5 transition-all uppercase shadow-inner-soft"
                                value={newSkuForm.name}
                                onChange={e => setNewSkuForm({...newSkuForm, name: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Brand</label>
                                <select 
                                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner-soft appearance-none"
                                    value={newSkuForm.brand}
                                    onChange={e => setNewSkuForm({...newSkuForm, brand: e.target.value as Brand})}
                                >
                                    <option value={Brand.HYUNDAI}>HYUNDAI</option>
                                    <option value={Brand.MAHINDRA}>MAHINDRA</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">MRP Rate (₹)</label>
                                <input 
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner-soft"
                                    value={newSkuForm.mrp}
                                    onChange={e => setNewSkuForm({...newSkuForm, mrp: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 flex gap-3 mt-6">
                    <button 
                        onClick={() => setIsAddingNewSku(false)}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-95 text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmAddNewSku}
                        className="flex-[1.5] px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                    >
                        Confirm SKU
                    </button>
                </div>
            </div>
         </div>
       )}

       {/* MOBILE SEARCH MODAL (ENHANCED FOR NEW SKU) */}
       {showMobileSearch && (
         <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-slide-up h-[100dvh] w-screen overflow-hidden">
            <div className="flex-none h-24 flex items-end px-6 pb-5 gap-4 bg-white border-b border-slate-100 shadow-sm">
               <button onClick={() => { setShowMobileSearch(false); }} className="p-3 text-slate-900 bg-slate-50 rounded-2xl active:scale-90 transition-all border border-slate-100 shadow-soft">
                  <ArrowLeft size={24} strokeWidth={3} />
               </button>
               <div className="flex-1">
                  <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none uppercase">Item Finder</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] mt-2">Active Catalog Scan</p>
               </div>
            </div>
            
            <div className="p-6">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={24} strokeWidth={2.5} />
                    <input 
                        autoFocus
                        type="text" 
                        className="w-full bg-slate-100/50 p-5 pl-14 rounded-3xl border-none text-[18px] font-black shadow-inner outline-none ring-2 ring-transparent focus:ring-blue-500/10 transition-all placeholder:text-slate-300 uppercase tracking-tight"
                        placeholder="Scan Part No..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-50/30">
                {suggestions.map(item => {
                    const available = getAvailableStock(item);
                    return (
                        <button 
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className="w-full bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-soft flex justify-between items-center text-left active:scale-[0.97] transition-all group"
                        >
                            <div className="flex-1 min-w-0 pr-6">
                                <div className="flex items-center gap-3 mb-2.5">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {item.brand.slice(0,3)}
                                    </span>
                                    <div className="font-black text-slate-900 text-[19px] tracking-tighter truncate uppercase leading-none">{item.partNumber}</div>
                                </div>
                                <div className="text-[13px] text-slate-400 font-bold truncate mb-3 pl-1">{item.name}</div>
                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shadow-inner-soft inline-block ${available > 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                   STK: {fd(available)}
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] shadow-xl flex items-center justify-center group-active:scale-90 transition-all">
                                <Plus size={28} strokeWidth={3.5} />
                            </div>
                        </button>
                    );
                })}

                {suggestions.length === 0 && search.length > 2 && mode === 'PURCHASE' && (
                    <div className="p-8 bg-white border-2 border-dashed border-indigo-100 rounded-[2.5rem] text-center animate-fade-in">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <PlusSquare size={32} strokeWidth={2.5} />
                        </div>
                        <h4 className="font-black text-slate-900 text-lg mb-2 uppercase">Unregistered SKU</h4>
                        <p className="text-slate-400 text-xs font-bold mb-10 leading-relaxed uppercase tracking-widest px-4">The part "{search.toUpperCase()}" is not in the system.</p>
                        <button 
                           onClick={openNewSkuModal}
                           className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase text-xs tracking-widest"
                        >
                           <Sparkles size={20} /> Initialize Registry
                        </button>
                    </div>
                )}
            </div>
         </div>
       )}

       {/* DESKTOP SPLIT UI */}
       <div className="hidden lg:grid grid-cols-12 gap-10 h-full p-2">
           <div className="col-span-7 bg-white rounded-[3rem] shadow-premium border border-slate-200/60 flex flex-col overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/20">
                   <div className="relative group">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={26} strokeWidth={2.5} />
                       <input 
                         type="text" 
                         className="w-full pl-16 pr-6 py-6 bg-white border border-slate-200 rounded-[2.5rem] text-2xl font-black placeholder:text-slate-200 focus:ring-12 focus:ring-blue-500/5 shadow-inner-soft outline-none transition-all uppercase tracking-tight"
                         placeholder="Scan Part Number..."
                         value={search}
                         onChange={e => handleSearch(e.target.value)}
                       />
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  {suggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-5">
                         {suggestions.map(item => {
                            const available = getAvailableStock(item);
                            return (
                                <button 
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="group/btn text-left p-6 rounded-[2.5rem] border-2 border-slate-50 bg-white hover:border-blue-100 hover:shadow-soft transition-all duration-300 active:scale-[0.98]"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="font-black text-lg text-slate-900 tracking-tight uppercase leading-none">{item.partNumber}</span>
                                        <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${available > 0 ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                            {fd(available)} AVL
                                        </div>
                                    </div>
                                    <div className="text-[13px] text-slate-400 font-bold truncate mb-5 uppercase tracking-tight">{item.name}</div>
                                    <div className="flex justify-between items-center">
                                        <div className="font-black text-xl text-slate-900 tracking-tighter">₹{item.price.toLocaleString()}</div>
                                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg opacity-0 group-hover/btn:opacity-100 transition-all active:scale-90">
                                            <Plus size={18} strokeWidth={3.5} />
                                        </div>
                                    </div>
                                </button>
                            );
                         })}
                      </div>
                  ) : search.length > 2 && mode === 'PURCHASE' ? (
                      <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto animate-fade-in">
                          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
                              <Tag size={40} strokeWidth={2} />
                          </div>
                          <h3 className="font-black text-slate-900 text-2xl tracking-tight mb-2 uppercase">Unregistered SKU</h3>
                          <p className="text-slate-400 font-bold text-sm mb-10 leading-relaxed uppercase tracking-widest">Part "{search.toUpperCase()}" is not in the system.</p>
                          <button 
                             onClick={openNewSkuModal}
                             className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                          >
                             <PlusSquare size={20} /> Create Registry
                          </button>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-200">
                          <PackagePlus size={80} className="mb-8 opacity-10" />
                          <p className="font-black text-slate-300 uppercase tracking-[0.4em] text-xs text-center">Protocol Scanner Offline</p>
                      </div>
                  )}
               </div>
           </div>

           <div className="col-span-5 bg-[#1E293B] rounded-[3rem] shadow-premium border border-white/5 flex flex-col overflow-hidden relative text-white">
                <div className="p-10 border-b border-white/5 flex justify-between items-center">
                    <h2 className="font-black text-2xl tracking-tight flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20"><ShoppingCart size={24} strokeWidth={2.5} /></div> REGISTRY
                    </h2>
                </div>

                <div className="p-10 pb-6">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-4 block ml-2">Entity Profile</span>
                    <input 
                        type="text" 
                        className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl text-lg font-black text-white outline-none focus:bg-white/10 transition-all placeholder:text-white/20 uppercase tracking-tight"
                        placeholder="Verified Provider"
                        value={customerName}
                        onChange={e => handleCustomerType(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-10 pt-0 space-y-4 no-scrollbar">
                    {cart.map(item => (
                        <div key={item.tempId} className={`p-6 rounded-[2rem] border border-white/5 bg-white/[0.03] flex flex-col gap-4 animate-fade-in hover:bg-white/[0.05] transition-all ${item.isNewSku ? 'ring-1 ring-blue-500/30' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4 flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="font-black text-white text-lg tracking-tight uppercase leading-none">{item.partNumber}</div>
                                        {item.isNewSku && <span className="text-[8px] font-black bg-blue-600 px-1.5 py-0.5 rounded text-white uppercase tracking-widest">NEW SKU</span>}
                                    </div>
                                    <div className="text-[11px] text-white/40 font-bold truncate uppercase tracking-tight">{item.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-white text-lg tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl">
                                        <button onClick={() => updateQty(item.tempId, -1)} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all"><Minus size={16} strokeWidth={3}/></button>
                                        <input 
                                          type="number"
                                          className="w-12 bg-transparent text-white font-black text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={item.quantity}
                                          onChange={(e) => setQtyDirect(item.tempId, parseInt(e.target.value) || 1)}
                                          onFocus={(e) => e.target.select()}
                                        />
                                        <button onClick={() => updateQty(item.tempId, 1)} className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all"><Plus size={16} strokeWidth={3}/></button>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/5 p-2 px-4 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Disc %</span>
                                        <input 
                                          type="number"
                                          className="w-12 bg-transparent text-white font-black text-center outline-none"
                                          value={item.discount}
                                          onChange={(e) => updateDiscount(item.tempId, parseFloat(e.target.value) || 0)}
                                          onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                    <button onClick={() => removeItem(item.tempId)} className="text-white/20 hover:text-rose-400 p-2.5 rounded-2xl transition-all ml-auto"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-10 border-t border-white/5 bg-black/20">
                    <div className="flex justify-between items-end mb-8 px-2">
                        <span className="text-white/40 font-black uppercase tracking-[0.3em] text-[10px]">Net Settlement</span>
                        <span className="text-4xl font-black text-white tracking-tighter tabular-nums">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <button 
                       onClick={executeSubmit} 
                       disabled={loading || cart.length === 0} 
                       className={`w-full py-6 rounded-[2rem] font-black text-white text-[18px] shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-4 uppercase tracking-[0.1em] ${accentColor} border border-white/10`}
                    >
                       {loading ? <Loader2 className="animate-spin" size={24} /> : (
                         <>Authorize Inbound <ArrowRight size={26} strokeWidth={2.5} /></>
                       )}
                    </button>
                </div>
           </div>
       </div>

       {/* MOBILE UI (FOOTER & LIST) */}
       <div className="lg:hidden flex flex-col h-full bg-slate-50">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-60 no-scrollbar">
              <div className="space-y-5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Active Registry ({fd(cart.length)})</h4>
                  {cart.length === 0 ? (
                      <div className="bg-white/40 border-4 border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
                         <ShoppingCart size={40} className="mx-auto mb-6 text-slate-200 opacity-50" />
                         <p className="font-black text-slate-300 uppercase tracking-[0.4em] text-[10px]">Session Empty</p>
                      </div>
                  ) : (
                     cart.map(item => (
                        <div key={item.tempId} className={`bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-200/60 flex flex-col gap-6 animate-fade-in ${item.isNewSku ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}>
                           <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <div className="font-black text-slate-900 text-2xl tracking-tighter leading-none uppercase">{item.partNumber}</div>
                                    {item.isNewSku && <span className="text-[10px] font-black bg-indigo-600 px-2 py-0.5 rounded text-white uppercase tracking-widest">New Part</span>}
                                  </div>
                                  <div className="text-[13px] text-slate-400 font-bold truncate leading-none uppercase tracking-tight">{item.name}</div>
                               </div>
                               <div className="text-right">
                                  <div className="font-black text-slate-900 text-2xl tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</div>
                               </div>
                           </div>
                           <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                               <button onClick={() => removeItem(item.tempId)} className="p-4 text-rose-500 bg-rose-50 rounded-2xl active:scale-90 transition-all border border-rose-100"><Trash2 size={24} /></button>
                               <div className="flex flex-col items-center gap-3">
                                   <div className="flex items-center gap-3 bg-slate-50 p-2 px-4 rounded-xl border border-slate-100 shadow-inner-soft">
                                       <span className="text-[9px] font-black text-slate-400 uppercase">Discount %</span>
                                       <input 
                                         type="number"
                                         className="w-10 bg-transparent text-slate-900 font-black text-center outline-none"
                                         value={item.discount}
                                         onChange={(e) => updateDiscount(item.tempId, parseFloat(e.target.value) || 0)}
                                         onFocus={(e) => e.target.select()}
                                       />
                                   </div>
                                   <div className="flex items-center gap-8 bg-slate-100 p-2 rounded-2xl shadow-inner-soft">
                                       <button onClick={() => updateQty(item.tempId, -1)} className="w-12 h-12 bg-white shadow-soft rounded-xl flex items-center justify-center text-slate-600 active:scale-90 transition-all"><Minus size={20} strokeWidth={4}/></button>
                                       <input 
                                          type="number"
                                          className="w-12 bg-transparent text-slate-900 font-black text-center outline-none text-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={item.quantity}
                                          onChange={(e) => setQtyDirect(item.tempId, parseInt(e.target.value) || 1)}
                                          onFocus={(e) => e.target.select()}
                                        />
                                       <button onClick={() => updateQty(item.tempId, 1)} className={`w-12 h-12 ${accentColor} text-white shadow-xl rounded-xl flex items-center justify-center active:scale-90 transition-all`}><Plus size={20} strokeWidth={4}/></button>
                                   </div>
                               </div>
                           </div>
                        </div>
                     ))
                  )}
              </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-200/60 p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] z-[80] pb-safe rounded-t-[3rem]">
              <button 
                 onClick={() => setShowMobileSearch(true)}
                 className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-4 mb-8 transition-all active:scale-95 text-[17px] uppercase tracking-widest shadow-2xl border border-white/10"
              >
                  <PackagePlus size={26} strokeWidth={2.5} /> Open Catalog Scan
              </button>
              <div className="flex items-center gap-8">
                  <div className="flex-1 px-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Net Total</p>
                     <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{totalAmount.toLocaleString()}</p>
                  </div>
                  <button 
                     onClick={executeSubmit}
                     disabled={loading || cart.length === 0}
                     className={`flex-[1.5] text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 text-[18px] ${accentColor}`}
                  >
                     {loading ? <Loader2 className="animate-spin" size={28} /> : (
                        <><span className="uppercase text-[12px] tracking-widest">Commit</span> <ArrowRight size={24} strokeWidth={3} /></>
                     )}
                  </button>
              </div>
          </div>
       </div>

       <ConfirmModal
         isOpen={showConfirm}
         onClose={() => setShowConfirm(false)}
         onConfirm={executeSubmit}
         loading={loading}
         variant="danger"
         title="Verify Protocol"
         message={`Security Checkpoint: Confirming acquisition of ${fd(cart.length)} units. Requisitions will be automatically marked as received.`}
         confirmLabel="Confirm"
       />
    </div>
  );
};

export default DailyTransactions;
