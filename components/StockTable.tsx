import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, Loader2, Eye, EyeOff, Lock, Info, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand; 
  userRole?: Role;
  enableActions?: boolean;
  externalSearch?: string;
  hideToolbar?: boolean;
  stockStatusFilter?: 'ALL' | 'LOW' | 'OUT';
  hidePriceByDefault?: boolean;
}

const PriceCell: React.FC<{ price: number; partNumber: string; userRole?: Role }> = ({ price, partNumber, userRole }) => {
  const [visible, setVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PriceHistoryEntry | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isManager = userRole === Role.MANAGER;

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  const handlePriceClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isManager) return;

    if (!visible) {
      setVisible(true);
      return;
    }

    // If already visible, show history popup
    if (!showHistory) {
      setShowHistory(true);
      if (!history && !loadingHistory) {
        setLoadingHistory(true);
        try {
          const data = await fetchPriceHistory(partNumber);
          if (data && data.length > 0) {
            // Get the most recent change
            setHistory(data[0]);
          }
        } catch (err) {
          console.error("Failed to load price history", err);
        } finally {
          setLoadingHistory(false);
        }
      }
    } else {
      setShowHistory(false);
    }
  };

  if (isManager) {
    return (
      <div className="flex items-center justify-end gap-2 text-slate-300 select-none">
        <span className="blur-[4px] tracking-tighter">₹88,888</span>
        <div className="bg-slate-100 p-1 rounded-md">
          <Lock size={12} className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex justify-end items-center">
      <div 
        onClick={handlePriceClick}
        className={`cursor-pointer select-none font-black text-[15px] transition-all duration-200 flex items-center justify-end gap-2 group/price px-2 py-1 rounded-lg ${visible ? 'text-slate-900 bg-slate-50' : 'text-slate-300 hover:text-slate-400 hover:bg-slate-50/50'}`}
      >
        {visible ? (
          <>
            <span className="flex items-center gap-1">
              ₹{price.toLocaleString()}
              {history && <div className="w-1 h-1 rounded-full bg-brand-500 animate-pulse" title="History available" />}
            </span>
            <Info size={14} className={`opacity-40 group-hover/price:opacity-100 transition-opacity ${showHistory ? 'text-brand-600 opacity-100' : ''}`} />
          </>
        ) : (
          <>
            <span className="blur-[4px] tracking-tighter">₹88,888</span>
            <div className="bg-slate-100 p-1 rounded-md">
              <Eye size={12} className="text-slate-400" />
            </div>
          </>
        )}
      </div>

      {/* PRICE HISTORY POPOVER */}
      {showHistory && (
        <div 
          ref={popoverRef}
          className="absolute bottom-full right-0 mb-3 z-[100] w-64 bg-white rounded-2xl shadow-premium border border-slate-100 p-5 animate-slide-up overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
          
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MRP Comparison</h4>
            <div className="p-1 bg-slate-50 rounded-md">
              <Clock size={12} className="text-slate-400" />
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-4 flex flex-col items-center gap-2">
              <Loader2 size={18} className="animate-spin text-brand-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Checking History...</span>
            </div>
          ) : history ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Old Price</p>
                  <p className="text-lg font-bold text-slate-400 line-through decoration-slate-300">₹{history.oldPrice.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center">
                   {history.newPrice > history.oldPrice ? (
                     <div className="bg-rose-50 text-rose-600 p-1.5 rounded-full">
                       <TrendingUp size={16} />
                     </div>
                   ) : (
                     <div className="bg-teal-50 text-teal-600 p-1.5 rounded-full">
                       <TrendingDown size={16} />
                     </div>
                   )}
                   <span className={`text-[9px] font-black mt-1 ${history.newPrice > history.oldPrice ? 'text-rose-500' : 'text-teal-500'}`}>
                     {history.newPrice > history.oldPrice ? '+' : '-'}{Math.abs(((history.newPrice - history.oldPrice) / history.oldPrice) * 100).toFixed(1)}%
                   </span>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] font-bold text-brand-500 uppercase tracking-tight">Current Price</p>
                  <p className="text-lg font-black text-slate-900">₹{history.newPrice.toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                 <span className="text-[9px] font-bold text-slate-400 uppercase">Last Changed</span>
                 <span className="text-[10px] font-black text-slate-600 italic">{new Date(history.changeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
               <p className="text-sm font-bold text-slate-400">No price changes recorded.</p>
               <p className="text-[9px] font-medium text-slate-300 uppercase mt-1">Showing first entry</p>
               <div className="mt-3 font-black text-slate-900 text-lg">₹{price.toLocaleString()}</div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-3 h-3 bg-white border-r border-b border-slate-100"></div>
        </div>
      )}
    </div>
  );
};

const StockTable: React.FC<StockTableProps> = ({ 
    items, 
    title, 
    brandFilter, 
    userRole, 
    enableActions = true,
    externalSearch,
    hideToolbar = false,
    stockStatusFilter = 'ALL',
    hidePriceByDefault = false
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 50;
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);

  const isOwner = userRole === Role.OWNER;
  const isManager = userRole === Role.MANAGER;
  const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;

  // Logic: MRP is hidden by default for everyone if hidePriceByDefault is true, 
  // or ALWAYS hidden for Managers on this specific request.
  const shouldHidePrice = hidePriceByDefault || isManager;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedParts(new Set());
  }, [effectiveSearch, brandFilter, showArchived, stockStatusFilter]);

  const toggleSelect = (partNumber: string) => {
      const newSet = new Set(selectedParts);
      if (newSet.has(partNumber)) newSet.delete(partNumber);
      else newSet.add(partNumber);
      setSelectedParts(newSet);
  };

  const handleBulkArchive = async () => {
      if (!confirm(`Archive ${selectedParts.size} items?`)) return;
      setIsArchiving(true);
      try {
        await bulkArchiveItems(Array.from(selectedParts), true);
        setSelectedParts(new Set());
        window.location.reload(); 
      } catch (e) {
        alert("Failed to archive items. Please try again.");
      } finally {
        setIsArchiving(false);
      }
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
        if (!showArchived && item.isArchived) return false;
        if (showArchived && !item.isArchived) return false;
        if (brandFilter && item.brand !== brandFilter) return false;
        if (stockStatusFilter === 'LOW' && (item.quantity === 0 || item.quantity >= item.minStockThreshold)) return false;
        if (stockStatusFilter === 'OUT' && item.quantity > 0) return false;
        if (effectiveSearch) {
            const lower = effectiveSearch.toLowerCase();
            return (
                item.partNumber.toLowerCase().includes(lower) ||
                item.name.toLowerCase().includes(lower) ||
                item.hsnCode.toLowerCase().includes(lower)
            );
        }
        return true;
    });

    if (sortConfig) {
        result.sort((a, b) => {
            const aVal = a[sortConfig.key] ?? 0;
            const bVal = b[sortConfig.key] ?? 0;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return result;
  }, [items, effectiveSearch, brandFilter, showArchived, sortConfig, stockStatusFilter]);

  const [mobileLimit, setMobileLimit] = useState(20);
  const mobileItems = filteredItems.slice(0, mobileLimit);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAllPageSelected = currentItems.length > 0 && currentItems.every(i => selectedParts.has(i.partNumber));

  const toggleSelectAllPage = () => {
    const newSet = new Set(selectedParts);
    if (isAllPageSelected) {
        currentItems.forEach(i => newSet.delete(i.partNumber));
    } else {
        currentItems.forEach(i => newSet.add(i.partNumber));
    }
    setSelectedParts(newSet);
  };

  const requestSort = (key: keyof StockItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ col }: { col: keyof StockItem }) => {
      if (sortConfig?.key !== col) return <ArrowUpDown size={12} className="opacity-20" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-brand-600" /> : <ArrowDown size={12} className="text-brand-600" />;
  };

  return (
    <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-soft border border-slate-50 flex flex-col h-full overflow-hidden">
      {!hideToolbar && (
        <div className="p-4 lg:p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <h2 className="font-black text-slate-900 text-lg">{title || 'Items Catalog'}</h2>
               <span className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-[11px] font-black">{filteredItems.length} Total</span>
            </div>
            
            <div className="flex items-center gap-3">
                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={14} /> : null}
                        Archive ({selectedParts.size})
                    </button>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                    type="text" 
                    placeholder="Quick filter..." 
                    className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-brand-500/10 w-full md:w-64 transition-all"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`p-2.5 rounded-2xl border transition-all active:scale-95 ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                    >
                        {showArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {enableActions && isOwner && selectedParts.size > 0 && (
        <div className="bg-brand-50 border-b border-brand-100 p-2 text-center text-[13px] text-brand-800 animate-slide-up">
           <b>{selectedParts.size}</b> items selected.
           <button onClick={() => setSelectedParts(new Set())} className="ml-3 font-bold hover:underline">Deselect All</button>
        </div>
      )}

      {/* DESKTOP VIEW */}
      <div className="hidden md:block flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-6 py-4 w-10">
                            <input 
                              type="checkbox" 
                              checked={isAllPageSelected}
                              onChange={toggleSelectAllPage} 
                              className="w-4 h-4 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500" 
                            />
                        </th>
                    )}
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-1">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center w-24">Brand</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center cursor-pointer" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-1">Qty <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right cursor-pointer" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-1">MRP <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-6 py-4 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] w-20">Link</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-medium text-lg italic">No parts matching your search.</td></tr>
                ) : (
                    currentItems.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-brand-50/30' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-6 py-5">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleSelect(item.partNumber)}
                                            className="w-4 h-4 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500" 
                                        />
                                    </td>
                                )}
                                <td className="px-6 py-5">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-bold text-slate-900 hover:text-brand-600 transition-colors">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-600">OUT</span>}
                                </td>
                                <td className="px-6 py-5 text-slate-600 font-medium">{item.name}</td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.brand === Brand.HYUNDAI ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                        {item.brand.substring(0, 3)}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`font-black text-[15px] ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-800'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  {shouldHidePrice ? <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} /> : <div className="font-black text-slate-900 text-[15px]">₹{item.price.toLocaleString()}</div>}
                                </td>
                                {enableActions && (
                                    <td className="px-6 py-5 text-center">
                                         <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-300 group-hover:text-brand-600 transition-all p-2 hover:bg-brand-50 rounded-xl inline-block">
                                            <Eye size={18} strokeWidth={2.5} />
                                         </Link>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        
        {/* PAGINATION */}
        <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between bg-white sticky bottom-0">
          <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-20 transition-all active:scale-95">
                  <ChevronLeft size={20} />
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-20 transition-all active:scale-95">
                  <ChevronRight size={20} />
              </button>
          </div>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex-1 overflow-y-auto bg-slate-50/30 p-3 space-y-3 no-scrollbar">
         {mobileItems.length === 0 ? (
             <div className="p-20 text-center text-slate-400 font-medium italic">No parts found.</div>
         ) : (
             mobileItems.map((item) => {
                const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                const isZero = item.quantity === 0;
                
                return (
                  <div 
                    key={item.id}
                    className={`block bg-white border border-slate-100 p-4 rounded-3xl shadow-sm active:scale-[0.98] transition-all overflow-hidden relative ${isZero ? 'opacity-70' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1.5 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                  {item.brand.substring(0, 3)}
                                </span>
                                <span className="font-black text-slate-900 text-lg tracking-tight">{item.partNumber}</span>
                            </div>
                            <p className="text-[13px] text-slate-500 font-medium line-clamp-2 leading-tight">{item.name}</p>
                        </div>
                        
                        <div className="text-right flex flex-col items-end gap-1">
                            <div className={`font-black text-[22px] leading-none mb-1 ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                {item.quantity}
                                <span className="text-[10px] uppercase font-bold text-slate-300 ml-1">PCS</span>
                            </div>
                            <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${isZero ? 'bg-rose-50 text-rose-600' : isLow ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'}`}>
                                {isZero ? 'Out Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Price (MRP)</span>
                            {shouldHidePrice ? <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} /> : <div className="font-black text-slate-900 text-[15px]">₹{item.price.toLocaleString()}</div>}
                        </div>
                        <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="bg-slate-50 text-slate-500 font-bold text-[11px] px-4 py-2 rounded-xl flex items-center gap-1 active:bg-brand-50 active:text-brand-600 transition-colors">
                            Details <ChevronRight size={14} />
                        </Link>
                    </div>
                  </div>
                );
             })
         )}
         
         {mobileLimit < filteredItems.length && (
            <button 
              onClick={() => setMobileLimit(prev => prev + 20)}
              className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-white transition-all bg-white/50"
            >
               Load More ({filteredItems.length - mobileLimit} left)
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;