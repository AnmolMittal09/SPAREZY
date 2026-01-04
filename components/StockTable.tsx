import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory, toggleArchiveStatus } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, Loader2, Eye, EyeOff, Lock, TrendingUp, TrendingDown, Clock, ArrowRight, CheckSquare, Square, MinusSquare, X, History, Calendar, ChevronDown } from 'lucide-react';

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
  const [flipPosition, setFlipPosition] = useState<'top' | 'bottom'>('top');
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const isManager = userRole === Role.MANAGER;
  const isOwner = userRole === Role.OWNER;
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

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (visible) return; 
    setVisible(true);
    if (isOwner) await loadHistory();
  };

  const handleToggleHistory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!visible) {
        setVisible(true);
    }

    // Detect if trigger is too high in the viewport to avoid clipping
    if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setFlipPosition(rect.top < 350 ? 'bottom' : 'top');
    }

    await loadHistory();
    setShowHistory(!showHistory);
  };

  const AuditContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner-3d">
              <Clock size={16} strokeWidth={2.5} />
           </div>
           <div>
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Audit Trail</h4>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Price Ledger</p>
           </div>
        </div>
        <span className="text-[10px] font-black bg-slate-900 px-3 py-1 rounded-full text-white shadow-3d">
           {history.length} RECORDS
        </span>
      </div>

      {loadingHistory ? (
        <div className="py-12 flex flex-col items-center gap-4">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Querying DB...</span>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-3 overflow-y-auto no-scrollbar pr-1 flex-1 max-h-[300px]">
          {history.map((entry) => {
            const isIncrease = entry.newPrice > entry.oldPrice;
            const percentChange = entry.oldPrice > 0 
               ? (((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1) 
               : '0.0';

            return (
              <div key={entry.id} className={`group relative p-4 rounded-3xl transition-all border shadow-3d ${isIncrease ? 'bg-rose-50/30 border-rose-100' : 'bg-teal-50/30 border-teal-100'}`}>
                 <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                       <Calendar size={12} className="text-slate-300" />
                       <span className="text-[11px] font-black text-slate-500">
                          {new Date(entry.changeDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                       </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter shadow-3d ${isIncrease ? 'bg-rose-100 text-rose-600' : 'bg-teal-100 text-teal-600'}`}>
                       {isIncrease ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                       {isIncrease ? '+' : ''}{percentChange}%
                    </div>
                 </div>
                 <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Previous</span>
                       <span className="text-[14px] font-bold text-slate-400 line-through">₹{entry.oldPrice.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-full shadow-inner-3d">
                        <ArrowRight size={14} className="text-slate-300" />
                    </div>
                    <div className="flex flex-col text-right">
                       <span className="text-[9px] font-black text-indigo-500 uppercase mb-1">New MRP</span>
                       <span className="text-[17px] font-black text-slate-900 tracking-tight">₹{entry.newPrice.toLocaleString()}</span>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-14 text-center bg-slate-50 rounded-4xl border border-dashed border-slate-200 shadow-inner-3d">
           <History size={32} className="text-slate-200 mx-auto mb-3 opacity-50" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No Audit Found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`} ref={triggerRef}>
      <div 
        onClick={visible ? (isMobile ? undefined : handleToggleHistory) : handleReveal}
        className={`group/price relative flex items-center gap-3 p-2 rounded-2xl transition-all duration-500 cursor-pointer card-3d ${
          visible 
            ? 'bg-slate-900 text-white shadow-3d ring-4 ring-indigo-500/10' 
            : 'bg-slate-50 text-slate-300 hover:bg-white hover:text-slate-600 hover:shadow-3d'
        }`}
      >
        {!visible ? (
          <>
            <div className="px-2 py-0.5 font-black text-[15px] blur-[8px] select-none tracking-tighter opacity-30">₹88,888</div>
            <div className="bg-white p-1.5 rounded-xl text-slate-400 shadow-3d group-hover/price:text-indigo-600 transition-all">
              <Eye size={14} strokeWidth={3} />
            </div>
          </>
        ) : (
          <>
            <div className="pl-3 pr-1 font-black text-[16px] tracking-tight py-0.5">₹{price.toLocaleString()}</div>
            {isOwner && !isMobile && (
                <div 
                  onClick={handleToggleHistory}
                  className={`p-2 rounded-xl transition-all shadow-3d active:scale-90 ${showHistory ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white hover:bg-indigo-400'}`}
                >
                  <History size={14} strokeWidth={3} />
                </div>
            )}
            {isManager && (
                <div className="p-1 rounded-lg text-white/40 mr-1">
                  <Lock size={12} />
                </div>
            )}
          </>
        )}
      </div>

      {!isMobile && showHistory && isOwner && (
        <div 
          ref={popoverRef}
          className={`absolute ${flipPosition === 'top' ? 'bottom-full mb-6' : 'top-full mt-6'} ${align === 'right' ? 'right-0' : 'left-0'} z-[600] w-80 bg-white rounded-4xl shadow-3d-hover border border-slate-100 p-8 animate-slide-up overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600 shadow-[0_2px_10px_rgba(79,70,229,0.3)]"></div>
          <AuditContent />
          <div className={`absolute ${flipPosition === 'top' ? 'bottom-[-7px]' : 'top-[-7px]'} left-1/2 -translate-x-1/2 rotate-45 w-4 h-4 bg-white border-${flipPosition === 'top' ? 'r' : 'l'} border-${flipPosition === 'top' ? 'b' : 't'} border-slate-100 shadow-3d`}></div>
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
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const maxSwipe = -90; 

    const onTouchStart = (e: React.TouchEvent) => {
        if (enableSelection && userRole === Role.OWNER) {
            const touchX = e.touches[0].clientX;
            if (touchX < 100) return; 
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

    const toggleMobileHistory = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showHistory && history.length === 0) {
            setLoadingHistory(true);
            try {
                const data = await fetchPriceHistory(item.partNumber);
                setHistory(data || []);
            } catch (err) {
                console.error("Failed to load price history", err);
            } finally {
                setLoadingHistory(false);
            }
        }
        setShowHistory(!showHistory);
    };

    const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
    const isZero = item.quantity === 0;

    return (
        <div className="relative overflow-visible rounded-4xl animate-fade-in mb-1">
            {/* Background Layer (Swipe Actions) */}
            <div className="absolute inset-0 flex justify-end rounded-4xl overflow-hidden">
                <div className="flex h-full">
                    <button 
                        onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
                        className="bg-brand-600 text-white w-24 flex flex-col items-center justify-center gap-2 shadow-inner-3d"
                    >
                        <Eye size={24} strokeWidth={3} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">View Details</span>
                    </button>
                </div>
            </div>

            {/* Foreground Content Card */}
            <div 
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ transform: `translateX(${currentX}px)` }}
                className={`relative bg-white border border-slate-100 p-6 rounded-4xl shadow-3d transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 flex flex-col gap-4 ${isZero ? 'bg-slate-50/80' : ''} ${isSelected ? 'ring-4 ring-brand-500/20 bg-brand-50 border-brand-200' : ''}`}
            >
                <div className="flex gap-5 items-center">
                    {enableSelection && userRole === Role.OWNER && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }}
                            className="flex-none active:scale-90 transition-transform p-1"
                        >
                            {isSelected ? <div className="bg-brand-600 text-white rounded-xl p-1 shadow-3d"><CheckSquare size={28} /></div> : <Square className="text-slate-200" size={32} />}
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                            <div className="space-y-2 flex-1 pr-3 min-w-0">
                                <div className="flex items-center gap-2.5">
                                    <span className={`flex-none text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-widest shadow-3d ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {item.brand.substring(0, 3)}
                                    </span>
                                    <span className="font-black text-slate-900 text-[18px] md:text-xl leading-tight tracking-tight break-all uppercase">
                                        {item.partNumber}
                                    </span>
                                </div>
                                <p className="text-[13px] text-slate-400 font-bold leading-relaxed">{item.name}</p>
                            </div>
                            <div className="text-right flex flex-col items-end flex-none pt-1">
                                <div className={`font-black text-2xl leading-none tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                    {item.quantity}
                                    <span className="text-[10px] uppercase font-black text-slate-300 ml-1.5 tracking-widest">PCS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                        {userRole === Role.OWNER && (
                            <button 
                                onClick={toggleMobileHistory}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-3d ${showHistory ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 active:scale-95'}`}
                            >
                                <History size={14} strokeWidth={3} />
                                {showHistory ? 'HIDE AUDIT' : 'LEDGER'}
                            </button>
                        )}
                    </div>
                    <div className="text-slate-200">
                        <ChevronRight size={20} strokeWidth={3} className="opacity-40" />
                    </div>
                </div>

                {showHistory && userRole === Role.OWNER && (
                    <div className="mt-2 p-5 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner-3d animate-slide-up">
                        <div className="flex items-center gap-3 mb-4 border-b border-slate-200 pb-3">
                            <Clock size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">MRP PRICE TRACKER</span>
                        </div>
                        
                        {loadingHistory ? (
                            <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={24} /></div>
                        ) : history.length > 0 ? (
                            <div className="space-y-3">
                                {history.map(entry => {
                                    const isIncrease = entry.newPrice > entry.oldPrice;
                                    return (
                                        <div key={entry.id} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-3d border border-white">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 mb-1 tracking-widest uppercase">{new Date(entry.changeDate).toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[12px] font-bold text-slate-400 line-through">₹{entry.oldPrice.toLocaleString()}</span>
                                                    <div className="bg-slate-50 p-1 rounded-full shadow-inner-3d"><ArrowRight size={10} className="text-slate-300" /></div>
                                                    <span className="text-[16px] font-black text-slate-900">₹{entry.newPrice.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase shadow-3d ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                                {isIncrease ? '+' : ''}{(((entry.newPrice - entry.oldPrice) / (entry.oldPrice || 1)) * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-[11px] font-black text-slate-400 text-center py-6 italic uppercase tracking-[0.3em]">No Audit Ledger Recorded</p>
                        )}
                    </div>
                )}
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
    <div className="bg-white rounded-4xl lg:rounded-4xl shadow-3d border border-slate-100 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="p-6 lg:p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-xl">
            <div className="flex items-center gap-5">
               <h2 className="font-black text-slate-900 text-2xl uppercase tracking-tighter">{title || 'Master Catalog'}</h2>
               <span className="bg-slate-900 text-white px-4 py-1.5 rounded-2xl text-[11px] font-black shadow-3d">{filteredItems.length} SKUs</span>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Desktop-only Archive Button */}
                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="hidden md:flex bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all items-center gap-3 active:scale-95 shadow-3d"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={16} /> : <Archive size={18} />}
                        Archive ({selectedParts.size})
                    </button>
                )}

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-600 transition-colors" size={20} />
                    <input 
                    type="text" 
                    placeholder="Search Catalog..." 
                    className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-[15px] font-bold focus:ring-[12px] focus:ring-brand-500/5 focus:bg-white w-full md:w-80 transition-all shadow-inner-3d"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {/* Desktop-only Archive Toggle */}
                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`hidden md:flex p-3 rounded-2xl border transition-all active:scale-95 shadow-3d ${showArchived ? 'bg-amber-500 border-amber-600 text-white shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)]' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                    >
                        {showArchived ? <ArchiveRestore size={22} strokeWidth={2.5} /> : <Archive size={22} strokeWidth={2.5} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {enableActions && isOwner && (
        <div className="md:hidden p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
           <button 
             onClick={toggleSelectPage}
             className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-3d active:scale-95 transition-all"
           >
              {isAllMobileSelected ? <CheckSquare size={24} className="text-brand-600" /> : <Square size={24} className="text-slate-300" />}
              SELECT VISIBLE
           </button>
           {selectedParts.size > 0 && <span className="text-[12px] font-black text-brand-600 bg-brand-50 px-4 py-2 rounded-2xl shadow-3d border border-brand-100">{selectedParts.size} SELECTED</span>}
        </div>
      )}

      {enableActions && isOwner && selectedParts.size > 0 && (
        <div className="bg-brand-600 px-6 py-5 text-center text-[14px] text-white animate-slide-up flex flex-col md:flex-row items-center justify-center gap-4 shadow-[0_15px_30px_rgba(14,165,233,0.3)] z-50">
           <p className="font-black uppercase tracking-[0.15em]">
             {isAllFilteredSelected 
               ? `Full Result Set (${filteredItems.length}) Locked.` 
               : `${selectedParts.size} Units selected.`
             }
           </p>
           <div className="flex gap-5">
             {((window.innerWidth >= 768 && isAllPageSelected) || (window.innerWidth < 768 && isAllMobileSelected)) && !isAllFilteredSelected && filteredItems.length > (window.innerWidth < 768 ? mobileLimit : currentItems.length) && (
               <button onClick={toggleSelectAllFiltered} className="underline font-black text-white hover:text-white/80 transition-colors uppercase text-[12px] tracking-[0.25em]">
                 Select All {filteredItems.length} In Catalog
               </button>
             )}
             <button onClick={() => setSelectedParts(new Set())} className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-2xl text-[12px] font-black transition-all uppercase tracking-[0.25em] shadow-inner-3d">Deselect</button>
           </div>
        </div>
      )}

      <div className="hidden md:block overflow-visible">
        <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-white/90 backdrop-blur-2xl sticky top-0 z-[400]">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-8 py-6 w-14">
                            <button 
                              onClick={toggleSelectPage} 
                              className="text-slate-300 hover:text-brand-600 transition-all active:scale-90"
                              title={isAllPageSelected ? "Deselect All" : "Select All"}
                            >
                              {isAllPageSelected ? <CheckSquare className="text-brand-600" size={28} /> : isPartiallySelected ? <MinusSquare className="text-brand-600" size={28} /> : <Square size={28} />}
                            </button>
                        </th>
                    )}
                    <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] cursor-pointer hover:text-slate-900 transition-colors" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-2">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] cursor-pointer hover:text-slate-900 transition-colors" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-2">Part Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] text-center w-32">Brand</th>
                    <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-2">Stock <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] text-right cursor-pointer hover:text-slate-900 transition-colors" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-2">Price <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-8 py-6 text-center text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] w-24">Link</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-32 text-center text-slate-300 font-black text-xl uppercase tracking-[0.5em] opacity-30">No Parts Matching Query</td></tr>
                ) : (
                    currentItems.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50/80 transition-all overflow-visible ${isSelected ? 'bg-brand-50/50' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-8 py-6">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleSelect(item.partNumber)}
                                            className="w-5 h-5 rounded-lg border-slate-200 text-brand-600 focus:ring-brand-500 shadow-inner-3d transition-all active:scale-90" 
                                        />
                                    </td>
                                )}
                                <td className="px-8 py-6">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-900 hover:text-brand-600 transition-colors text-lg tracking-tight uppercase">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-600 text-white shadow-3d animate-pulse">ZEROED</span>}
                                </td>
                                <td className="px-8 py-6 text-slate-500 font-bold tracking-tight">{item.name}</td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`inline-flex items-center px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-3d ${item.brand === Brand.HYUNDAI ? 'bg-blue-900 text-white' : 'bg-red-700 text-white'}`}>
                                        {item.brand.substring(0, 3)}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`font-black text-2xl tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-800'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right overflow-visible">
                                  <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} />
                                </td>
                                {enableActions && (
                                    <td className="px-8 py-6 text-center">
                                         <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-200 hover:text-brand-600 hover:bg-white hover:shadow-3d p-3 rounded-2xl inline-block transition-all transform hover:scale-110 active:scale-90">
                                            <Eye size={22} strokeWidth={3} />
                                         </Link>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        
        <div className="px-10 py-6 border-t border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky bottom-0 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Section {currentPage} of {totalPages}</span>
          <div className="flex gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 shadow-3d disabled:opacity-20 transition-all active:scale-95">
                  <ChevronLeft size={24} strokeWidth={3} />
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 shadow-3d disabled:opacity-20 transition-all active:scale-95">
                  <ChevronRight size={24} strokeWidth={3} />
              </button>
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-5 space-y-4 pb-32">
         {mobileItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-40 text-slate-200">
                <Search size={80} className="opacity-10 mb-8 transform -rotate-12" />
                <div className="text-center text-slate-300 font-black uppercase tracking-[0.4em] text-sm">Empty State</div>
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
              className="w-full py-8 text-[11px] font-black uppercase tracking-[0.5em] text-slate-300 border-4 border-dashed border-slate-100 rounded-4xl hover:bg-white hover:text-brand-600 transition-all bg-slate-50/50 shadow-inner-3d active:scale-[0.98]"
            >
               Expand Registry ({filteredItems.length - mobileLimit} More)
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;