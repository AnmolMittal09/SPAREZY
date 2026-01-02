import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory, toggleArchiveStatus } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, Loader2, Eye, EyeOff, Lock, Info, TrendingUp, TrendingDown, Clock, MoreHorizontal, ArrowRight, CheckSquare, Square, MinusSquare, X } from 'lucide-react';

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

const PriceCell: React.FC<{ price: number; partNumber: string; userRole?: Role; align?: 'left' | 'right' }> = ({ price, partNumber, userRole, align = 'right' }) => {
  const [visible, setVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isManager = userRole === Role.MANAGER;
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768;

  const loadHistory = async () => {
    if (history.length > 0 || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const data = await fetchPriceHistory(partNumber);
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to load price history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory, isMobile]);

  const handlePriceClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!visible) {
      setVisible(true);
      // Managers only reveal price on first click, Owners get history too
      if (!isMobile && !isManager) setShowHistory(true);
      await loadHistory();
    } else {
      // If already visible, second click on mobile shows history drawer
      if (isMobile) {
        setShowHistory(true);
      } else {
        // Desktop toggles off
        setVisible(false);
        setShowHistory(false);
      }
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile && visible && !isManager) {
      setShowHistory(true);
      loadHistory();
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setShowHistory(false);
    }
  };

  const HistoryContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
           <Clock size={16} className="text-slate-400" />
           <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Price Evolution</h4>
        </div>
        <span className="text-[10px] font-black bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500">
           {history.length} UPDATES
        </span>
      </div>

      {loadingHistory ? (
        <div className="py-10 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-brand-500" />
          <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Accessing Ledger...</span>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-4 overflow-y-auto no-scrollbar pr-1 flex-1">
          {history.map((entry, idx) => {
            const isIncrease = entry.newPrice > entry.oldPrice;
            const percentChange = entry.oldPrice > 0 
               ? (((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1) 
               : '0.0';

            return (
              <div key={entry.id} className={`flex flex-col gap-2 ${idx !== history.length - 1 ? 'pb-4 border-b border-slate-50' : ''}`}>
                 <div className="flex justify-between items-center">
                    <div className="text-[11px] font-bold text-slate-400">
                       {new Date(entry.changeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                       {isIncrease ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                       {isIncrease ? '+' : ''}{percentChange}%
                    </div>
                 </div>
                 <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-300 uppercase mb-0.5">From</span>
                       <span className="text-sm font-bold text-slate-400 line-through">₹{entry.oldPrice.toLocaleString()}</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-200" />
                    <div className="flex flex-col text-right">
                       <span className="text-[9px] font-black text-brand-400 uppercase mb-0.5">To</span>
                       <span className="text-base font-black text-slate-900">₹{entry.newPrice.toLocaleString()}</span>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
           <Clock size={24} className="text-slate-300 mx-auto mb-3" />
           <p className="text-sm font-bold text-slate-400">No price changes on record.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`}>
      <div 
        onClick={handlePriceClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`cursor-pointer select-none font-black text-[15px] transition-all duration-200 flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} gap-2 group/price px-2.5 py-1.5 rounded-xl ${visible ? 'text-slate-900 bg-slate-100 shadow-sm' : 'text-slate-300 hover:text-slate-400 hover:bg-slate-50'}`}
      >
        {visible ? (
          <>
            <span className="flex items-center gap-1.5">
              ₹{price.toLocaleString()}
              {history.length > 0 && !isManager && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />}
            </span>
            {!isManager && <Info size={16} className={`opacity-40 transition-opacity ${showHistory ? 'text-brand-600 opacity-100' : ''}`} />}
            {isManager && <Lock size={12} className="opacity-20" />}
          </>
        ) : (
          <>
            <span className="blur-[5px] tracking-tighter select-none">₹88,888</span>
            <div className="bg-slate-100 p-1.5 rounded-lg">
              {isManager ? <Lock size={14} className="text-slate-400" /> : <Eye size={14} className="text-slate-400" />}
            </div>
          </>
        )}
      </div>

      {/* DESKTOP POPOVER (Owners only) */}
      {!isMobile && showHistory && !isManager && (
        <div 
          ref={popoverRef}
          className={`absolute bottom-full ${align === 'right' ? 'right-0' : 'left-0'} mb-3 z-[100] w-72 bg-white rounded-3xl shadow-premium border border-slate-100 p-6 animate-slide-up overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-indigo-500"></div>
          <HistoryContent />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-4 h-4 bg-white border-r border-b border-slate-100"></div>
        </div>
      )}

      {/* MOBILE DRAWER (For everyone once revealed) */}
      {isMobile && showHistory && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowHistory(false)}>
           <div 
             className="w-full bg-white rounded-t-[2.5rem] shadow-2xl p-6 pb-12 animate-slide-up max-h-[85vh] flex flex-col"
             onClick={e => e.stopPropagation()}
           >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{partNumber}</h3>
                    <p className="text-sm font-bold text-slate-400 mt-2">Inventory Audit Details</p>
                 </div>
                 <button onClick={() => setShowHistory(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-500 active:scale-90 transition-all"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                <HistoryContent />
              </div>
              <div className="mt-8 flex gap-3">
                 <button 
                   onClick={() => { setVisible(false); setShowHistory(false); }} 
                   className="flex-1 py-5 bg-slate-100 text-slate-600 font-black rounded-[1.5rem] uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all"
                 >
                   Privacy Hide
                 </button>
                 <button 
                   onClick={() => setShowHistory(false)} 
                   className="flex-1 py-5 bg-slate-900 text-white font-black rounded-[1.5rem] uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-xl"
                 >
                   Got It
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

interface SwipeableItemProps {
    item: StockItem;
    userRole?: Role;
    shouldHidePrice: boolean;
    isSelected: boolean;
    toggleSelect: (partNumber: string) => void;
    enableSelection: boolean;
}

const SwipeableMobileItem: React.FC<SwipeableItemProps> = ({ item, userRole, shouldHidePrice, isSelected, toggleSelect, enableSelection }) => {
    const navigate = useNavigate();
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipedOpen, setSwipedOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);

    const isOwner = userRole === Role.OWNER;
    const maxSwipe = isOwner ? -160 : -80;

    const onTouchStart = (e: React.TouchEvent) => {
        if (enableSelection && isOwner) {
            const touchX = e.touches[0].clientX;
            if (touchX < 80) return; 
        }
        setStartX(e.touches[0].clientX);
        setIsSwiping(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;
        let newX = swipedOpen ? diff + maxSwipe : diff;
        if (newX > 0) newX = 0;
        if (newX < maxSwipe - 40) newX = maxSwipe - 40;
        setCurrentX(newX);
    };

    const onTouchEnd = () => {
        setIsSwiping(false);
        if (currentX < maxSwipe / 2) {
            setSwipedOpen(true);
            setCurrentX(maxSwipe);
        } else {
            setSwipedOpen(false);
            setCurrentX(0);
        }
    };

    const handleArchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Archive ${item.partNumber}?`)) return;
        setArchiving(true);
        try {
            await toggleArchiveStatus(item.partNumber, true);
            window.location.reload();
        } catch (err) {
            alert("Failed to archive item.");
        } finally {
            setArchiving(false);
        }
    };

    const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
    const isZero = item.quantity === 0;

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] animate-fade-in">
            <div className="absolute inset-0 flex justify-end">
                <div className="flex h-full">
                    <button 
                        onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
                        className="bg-brand-600 text-white w-20 flex flex-col items-center justify-center gap-1.5"
                    >
                        <Eye size={24} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Detail</span>
                    </button>
                    {isOwner && (
                        <button 
                            onClick={handleArchive}
                            disabled={archiving}
                            className="bg-rose-600 text-white w-20 flex flex-col items-center justify-center gap-1.5"
                        >
                            {archiving ? <Loader2 size={24} className="animate-spin" /> : <Archive size={24} />}
                            <span className="text-[9px] font-black uppercase tracking-widest">Archive</span>
                        </button>
                    )}
                </div>
            </div>

            <div 
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ transform: `translateX(${currentX}px)` }}
                className={`relative bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm transition-transform duration-200 ease-out z-10 flex gap-5 items-center ${isZero ? 'bg-slate-50/50' : ''} ${isSelected ? 'ring-2 ring-brand-500 bg-brand-50/50 border-brand-200 shadow-md' : ''}`}
            >
                {enableSelection && isOwner && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }}
                        className="flex-none p-2 active:scale-90 transition-transform"
                    >
                        {isSelected ? <CheckSquare className="text-brand-600" size={28} /> : <Square className="text-slate-300" size={28} />}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1.5 flex-1 pr-4 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`flex-none text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                    {item.brand.substring(0, 3)}
                                </span>
                                <span className="font-black text-slate-900 text-xl tracking-tight truncate">{item.partNumber}</span>
                            </div>
                            <p className="text-[14px] text-slate-500 font-medium truncate leading-tight">{item.name}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 flex-none">
                            <div className={`font-black text-[22px] leading-none ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                {item.quantity}
                                <span className="text-[10px] uppercase font-bold text-slate-300 ml-1.5">PCS</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">List Rate</span>
                            <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                            <span className="text-[9px] font-black uppercase tracking-widest">Swipe</span>
                            <ChevronLeft size={16} className="animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
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

  const shouldHidePrice = hidePriceByDefault || isManager;

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

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [mobileLimit, setMobileLimit] = useState(20);
  const mobileItems = filteredItems.slice(0, mobileLimit);

  // --- SELECTION LOGIC ---
  const isAllPageSelected = currentItems.length > 0 && currentItems.every(i => selectedParts.has(i.partNumber));
  const isAllMobileSelected = mobileItems.length > 0 && mobileItems.every(i => selectedParts.has(i.partNumber));
  
  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedParts.has(i.partNumber));
  const isPartiallySelected = selectedParts.size > 0 && !isAllPageSelected;

  const toggleSelectPage = () => {
    const newSet = new Set(selectedParts);
    const itemsToToggle = window.innerWidth < 768 ? mobileItems : currentItems;
    const isCurrentlySelected = window.innerWidth < 768 ? isAllMobileSelected : isAllPageSelected;

    if (isCurrentlySelected) {
      itemsToToggle.forEach(i => newSet.delete(i.partNumber));
    } else {
      itemsToToggle.forEach(i => newSet.add(i.partNumber));
    }
    setSelectedParts(newSet);
  };

  const toggleSelectAllFiltered = () => {
    setSelectedParts(new Set(filteredItems.map(i => i.partNumber)));
  };

  useEffect(() => {
    setCurrentPage(1);
    setMobileLimit(20);
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

      {enableActions && isOwner && (
        <div className="md:hidden p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
           <button 
             onClick={toggleSelectPage}
             className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm active:scale-95 transition-all"
           >
              {isAllMobileSelected ? <CheckSquare size={20} className="text-brand-600" /> : <Square size={20} className="text-slate-300" />}
              Select Viewable
           </button>
           {selectedParts.size > 0 && <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-3 py-1.5 rounded-xl">{selectedParts.size} Items</span>}
        </div>
      )}

      {enableActions && isOwner && selectedParts.size > 0 && (
        <div className="bg-brand-600 p-4 text-center text-[13px] text-white animate-slide-up flex flex-col md:flex-row items-center justify-center gap-3">
           <p className="font-bold">
             {isAllFilteredSelected 
               ? `All ${filteredItems.length} matching items selected.` 
               : `${selectedParts.size} items in current selection.`
             }
           </p>
           <div className="flex gap-4">
             {((window.innerWidth >= 768 && isAllPageSelected) || (window.innerWidth < 768 && isAllMobileSelected)) && !isAllFilteredSelected && filteredItems.length > (window.innerWidth < 768 ? mobileItems.length : currentItems.length) && (
               <button onClick={toggleSelectAllFiltered} className="underline font-black text-white hover:text-brand-100 transition-colors uppercase text-[11px] tracking-widest">
                 Select All {filteredItems.length} Result{filteredItems.length > 1 ? 's' : ''}
               </button>
             )}
             <button onClick={() => setSelectedParts(new Set())} className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest">Clear Selection</button>
           </div>
        </div>
      )}

      <div className="hidden md:block flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-6 py-4 w-10">
                            <button 
                              onClick={toggleSelectPage} 
                              className="text-slate-400 hover:text-brand-600 transition-colors"
                              title={isAllPageSelected ? "Deselect Page" : "Select Page"}
                            >
                              {isAllPageSelected ? <CheckSquare className="text-brand-600" size={20} /> : isPartiallySelected ? <MinusSquare className="text-brand-600" size={20} /> : <Square size={20} />}
                            </button>
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
                                  <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} />
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

      <div className="md:hidden flex-1 overflow-y-auto bg-slate-50/40 p-4 space-y-4 no-scrollbar">
         {mobileItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                <Search size={64} className="opacity-10 mb-4" />
                <div className="p-20 text-center text-slate-400 font-medium italic">No parts found.</div>
             </div>
         ) : (
             mobileItems.map((item) => (
                <SwipeableMobileItem 
                    key={item.id} 
                    item={item} 
                    userRole={userRole} 
                    shouldHidePrice={shouldHidePrice} 
                    isSelected={selectedParts.has(item.partNumber)}
                    toggleSelect={toggleSelect}
                    enableSelection={enableActions}
                />
             ))
         )}
         {mobileLimit < filteredItems.length && (
            <button 
              onClick={() => setMobileLimit(prev => prev + 20)}
              className="w-full py-6 text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] hover:bg-white transition-all bg-white shadow-sm active:scale-[0.98]"
            >
               Load More Results ({filteredItems.length - mobileLimit} left)
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;