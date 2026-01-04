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
           <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner-soft">
              <Clock size={14} strokeWidth={2.5} />
           </div>
           <div>
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Audit Trail</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pricing Ledger</p>
           </div>
        </div>
        <span className="text-[10px] font-black bg-slate-100 px-2.5 py-1 rounded-full text-slate-500 ring-1 ring-slate-200/50">
           {history.length} RECORDS
        </span>
      </div>

      {loadingHistory ? (
        <div className="py-12 flex flex-col items-center gap-4">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning history...</span>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-3 overflow-y-auto no-scrollbar pr-1 flex-1 max-h-[280px]">
          {history.map((entry) => {
            const isIncrease = entry.newPrice > entry.oldPrice;
            const percentChange = entry.oldPrice > 0 
               ? (((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1) 
               : '0.0';

            return (
              <div key={entry.id} className={`group relative p-4 rounded-[1.5rem] border transition-all ${isIncrease ? 'bg-rose-50/30 border-rose-100/60' : 'bg-teal-50/30 border-teal-100/60'}`}>
                 <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                       <Calendar size={12} className="text-slate-400" />
                       <span className="text-[11px] font-bold text-slate-500">
                          {new Date(entry.changeDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                       </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tight shadow-sm ${isIncrease ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                       {isIncrease ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                       {isIncrease ? '+' : ''}{percentChange}%
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-extrabold text-slate-400 uppercase mb-1">Old</span>
                       <span className="text-[14px] font-bold text-slate-400 line-through">₹{entry.oldPrice.toLocaleString()}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-soft ring-1 ring-slate-100">
                      <ArrowRight size={14} className="text-slate-400" />
                    </div>
                    <div className="flex flex-col text-right">
                       <span className="text-[9px] font-extrabold text-indigo-500 uppercase mb-1">New</span>
                       <span className="text-[17px] font-black text-slate-900 tracking-tight">₹{entry.newPrice.toLocaleString()}</span>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
           <History size={32} className="text-slate-200 mx-auto mb-3 opacity-50" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No history found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`} ref={triggerRef}>
      <div 
        onClick={visible ? (isMobile ? undefined : handleToggleHistory) : handleReveal}
        className={`group/price relative flex items-center gap-2.5 p-1.5 rounded-2xl transition-all duration-300 cursor-pointer ${
          visible 
            ? 'bg-slate-900 text-white shadow-elevated ring-1 ring-slate-800' 
            : 'bg-slate-50 text-slate-300 hover:bg-white hover:text-slate-500 hover:shadow-soft border border-slate-100'
        }`}
      >
        {!visible ? (
          <>
            <div className="px-2 py-0.5 font-black text-[15px] blur-[8px] select-none tracking-tighter opacity-30">₹88,888</div>
            <div className="bg-white p-1.5 rounded-xl text-slate-400 shadow-etched group-hover/price:text-indigo-600 transition-colors">
              <Eye size={14} strokeWidth={2.5} />
            </div>
          </>
        ) : (
          <>
            <div className="pl-3 pr-1 font-black text-[15px] tracking-tight py-0.5">₹{price.toLocaleString()}</div>
            {isOwner && !isMobile && (
                <div 
                  onClick={handleToggleHistory}
                  className={`p-2 rounded-xl transition-all shadow-etched active:scale-90 ${showHistory ? 'bg-indigo-600 text-white shadow-inner' : 'bg-indigo-500 text-white hover:bg-indigo-400'}`}
                >
                  <History size={13} strokeWidth={3} />
                </div>
            )}
            {isManager && (
                <div className="p-1 rounded-lg text-white/30 mr-1">
                  <Lock size={12} />
                </div>
            )}
          </>
        )}
      </div>

      {!isMobile && showHistory && isOwner && (
        <div 
          ref={popoverRef}
          className={`absolute ${flipPosition === 'top' ? 'bottom-full mb-5' : 'top-full mt-5'} ${align === 'right' ? 'right-0' : 'left-0'} z-[600] w-80 bg-white rounded-[2.5rem] shadow-elevated border border-slate-200/60 p-7 animate-slide-up overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 shadow-sm"></div>
          <AuditContent />
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

    const maxSwipe = -80; 

    const onTouchStart = (e: React.TouchEvent) => {
        if (enableSelection && userRole === Role.OWNER) {
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
        <div className="relative overflow-visible rounded-[2.5rem] animate-fade-in group">
            {/* Background Layer Action */}
            <div className="absolute inset-0 flex justify-end rounded-[2.5rem] overflow-hidden">
                <div className="flex h-full">
                    <button 
                        onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
                        className="bg-brand-600 text-white w-20 flex flex-col items-center justify-center gap-1 shadow-inner"
                    >
                        <Eye size={22} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Detail</span>
                    </button>
                </div>
            </div>

            {/* Foreground Content Card */}
            <div 
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ transform: `translateX(${currentX}px)` }}
                className={`relative bg-white border border-slate-200/70 p-6 rounded-[2.5rem] shadow-soft transition-all duration-300 ease-out z-10 flex flex-col gap-4 ${isZero ? 'bg-slate-50/50' : ''} ${isSelected ? 'ring-2 ring-brand-500 bg-brand-50 border-brand-200 shadow-premium' : ''}`}
            >
                <div className="flex gap-4 items-center">
                    {enableSelection && userRole === Role.OWNER && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }}
                            className="flex-none active:scale-90 transition-transform p-1"
                        >
                            {isSelected ? <CheckSquare className="text-brand-600" size={26} /> : <Square className="text-slate-200" size={26} />}
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1.5">
                            <div className="space-y-1.5 flex-1 pr-2 min-w-0">
                                <div className="flex items-start gap-2.5 flex-col">
                                    <span className={`flex-none text-[9px] px-2.5 py-0.5 rounded-lg font-black uppercase tracking-widest shadow-sm ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {item.brand}
                                    </span>
                                    <span className="font-black text-slate-900 text-[19px] leading-none tracking-tighter break-all">
                                        {item.partNumber}
                                    </span>
                                </div>
                                <p className="text-[13px] text-slate-400 font-bold leading-relaxed">{item.name}</p>
                            </div>
                            <div className="text-right flex flex-col items-end flex-none pt-1">
                                <div className={`font-black text-2xl leading-none flex items-baseline gap-1 ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                    {item.quantity}
                                    <span className="text-[10px] uppercase font-extrabold text-slate-300 tracking-widest">PCS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                        {userRole === Role.OWNER && (
                            <button 
                                onClick={toggleMobileHistory}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${showHistory ? 'bg-indigo-600 text-white border-indigo-700 shadow-inner' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white'}`}
                            >
                                <History size={12} strokeWidth={3} />
                                {showHistory ? 'Close Audit' : 'Audit trail'}
                            </button>
                        )}
                    </div>
                    <ChevronRight size={18} className="text-slate-200 group-hover:text-brand-400 transition-colors" />
                </div>

                {showHistory && userRole === Role.OWNER && (
                    <div className="mt-2 p-5 bg-slate-50/80 rounded-[2rem] border border-slate-200/50 animate-slide-up shadow-inner-soft">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-200/60 pb-3">
                            <Clock size={12} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">MRP Transaction Ledger</span>
                        </div>
                        
                        {loadingHistory ? (
                            <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
                        ) : history.length > 0 ? (
                            <div className="space-y-3">
                                {history.map(entry => {
                                    const isIncrease = entry.newPrice > entry.oldPrice;
                                    return (
                                        <div key={entry.id} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 ring-1 ring-slate-100">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{new Date(entry.changeDate).toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[12px] font-bold text-slate-400 line-through">₹{entry.oldPrice.toLocaleString()}</span>
                                                    <ArrowRight size={10} className="text-slate-300" />
                                                    <span className="text-[15px] font-black text-slate-900 tracking-tight">₹{entry.newPrice.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase shadow-inner-soft ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                                {isIncrease ? '+' : ''}{(((entry.newPrice - entry.oldPrice) / (entry.oldPrice || 1)) * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                              <p className="text-[10px] font-bold text-slate-400 italic uppercase tracking-[0.2em]">No records in database</p>
                            </div>
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
        alert("Failed to archive items.");
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
      if (sortConfig?.key !== col) return <ArrowUpDown size={12} className="opacity-10" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-brand-600" /> : <ArrowDown size={12} className="text-brand-600" />;
  };

  return (
    <div className="bg-white rounded-[2.5rem] lg:rounded-[3rem] shadow-soft border border-slate-200/60 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/20">
            <div className="flex items-center gap-4">
               <h2 className="font-black text-slate-900 text-xl tracking-tight">{title || 'Stock Catalog'}</h2>
               <span className="bg-white text-slate-500 ring-1 ring-slate-200 px-3.5 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-inner-soft">{filteredItems.length} items</span>
            </div>
            
            <div className="flex items-center gap-4">
                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="hidden md:flex bg-rose-50 text-rose-600 hover:bg-rose-100 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all items-center gap-2 active:scale-95 shadow-soft ring-1 ring-rose-200/50"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={14} /> : null}
                        Archive ({selectedParts.size})
                    </button>
                )}

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
                    <input 
                    type="text" 
                    placeholder="Quick lookup..." 
                    className="pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-[1.25rem] text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-300 w-full md:w-72 transition-all shadow-inner-soft"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`hidden md:flex p-3 rounded-2xl border transition-all active:scale-95 shadow-soft ${showArchived ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                        {showArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {enableActions && isOwner && (
        <div className="md:hidden p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
           <button 
             onClick={toggleSelectPage}
             className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 bg-white px-6 py-3.5 rounded-2xl border border-slate-200 shadow-soft active:scale-95 transition-all"
           >
              {isAllMobileSelected ? <CheckSquare size={22} className="text-brand-600" /> : <Square size={22} className="text-slate-300" />}
              Select Page
           </button>
           {selectedParts.size > 0 && <span className="text-[10px] font-black text-white bg-brand-600 px-3.5 py-1.5 rounded-xl shadow-lg shadow-brand-100">{selectedParts.size} Selected</span>}
        </div>
      )}

      {enableActions && isOwner && selectedParts.size > 0 && (
        <div className="bg-brand-600 p-5 text-center text-[13px] text-white animate-slide-up flex flex-col md:flex-row items-center justify-center gap-5 shadow-elevated">
           <p className="font-extrabold tracking-tight">
             {isAllFilteredSelected 
               ? `Complete batch of ${filteredItems.length} items ready.` 
               : `${selectedParts.size} specific entries selected.`
             }
           </p>
           <div className="flex gap-6">
             {((window.innerWidth >= 768 && isAllPageSelected) || (window.innerWidth < 768 && isAllMobileSelected)) && !isAllFilteredSelected && filteredItems.length > (window.innerWidth < 768 ? mobileLimit : currentItems.length) && (
               <button onClick={toggleSelectAllFiltered} className="underline font-black text-white hover:text-brand-100 transition-colors uppercase text-[10px] tracking-[0.2em]">
                 Select All {filteredItems.length} results
               </button>
             )}
             <button onClick={() => setSelectedParts(new Set())} className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ring-1 ring-white/20 shadow-inner">Cancel</button>
           </div>
        </div>
      )}

      <div className="hidden md:block overflow-visible">
        <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-slate-50/60 backdrop-blur-xl sticky top-0 z-[400] shadow-sm">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-8 py-5 w-14">
                            <button 
                              onClick={toggleSelectPage} 
                              className="text-slate-300 hover:text-brand-600 transition-all p-1"
                            >
                              {isAllPageSelected ? <CheckSquare className="text-brand-600" size={22} /> : isPartiallySelected ? <MinusSquare className="text-brand-600" size={22} /> : <Square size={22} />}
                            </button>
                        </th>
                    )}
                    <th className="px-8 py-5 font-extrabold text-slate-400 uppercase tracking-[0.2em] text-[10px] cursor-pointer group/h" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-8 py-5 font-extrabold text-slate-400 uppercase tracking-[0.2em] text-[10px] cursor-pointer group/h" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-8 py-5 font-extrabold text-slate-400 uppercase tracking-[0.2em] text-[10px] text-center w-32">Brand</th>
                    <th className="px-8 py-5 font-extrabold text-slate-400 uppercase tracking-[0.2em] text-[10px] text-center cursor-pointer group/h" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-2 group-hover/h:text-slate-600 transition-colors">Stock <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-8 py-5 font-extrabold text-slate-400 uppercase tracking-[0.2em] text-[10px] text-right cursor-pointer group/h" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-2 group-hover/h:text-slate-600 transition-colors">MRP <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-8 py-5 text-center text-slate-400 font-extrabold uppercase tracking-[0.2em] text-[10px] w-24">Link</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-32 text-center text-slate-400 font-bold text-lg italic uppercase tracking-widest opacity-40">No records found.</td></tr>
                ) : (
                    currentItems.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors overflow-visible ${isSelected ? 'bg-brand-50/40' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-8 py-6">
                                        <div className="p-1">
                                          <input 
                                              type="checkbox" 
                                              checked={isSelected} 
                                              onChange={() => toggleSelect(item.partNumber)}
                                              className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-4 focus:ring-brand-500/10 shadow-inner" 
                                          />
                                        </div>
                                    </td>
                                )}
                                <td className="px-8 py-6">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-900 hover:text-brand-600 transition-colors tracking-tight text-[15px]">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-100 text-rose-700 shadow-sm uppercase tracking-tighter">Out</span>}
                                </td>
                                <td className="px-8 py-6 text-slate-600 font-bold leading-relaxed">{item.name}</td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`inline-flex items-center px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-slate-100 ${item.brand === Brand.HYUNDAI ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                        {item.brand}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`font-black text-[17px] tracking-tight ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right overflow-visible">
                                  <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} />
                                </td>
                                {enableActions && (
                                    <td className="px-8 py-6 text-center">
                                         <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-300 group-hover:text-brand-600 group-hover:bg-white transition-all p-3 rounded-2xl inline-block shadow-sm ring-1 ring-transparent group-hover:ring-slate-100">
                                            <Eye size={20} strokeWidth={2.5} />
                                         </Link>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        
        <div className="px-8 py-5 border-t border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky bottom-0 z-[100] shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.25em]">Viewing page {currentPage} of {totalPages}</span>
          <div className="flex gap-3">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 disabled:opacity-20 transition-all active:scale-95 shadow-soft">
                  <ChevronLeft size={22} />
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 disabled:opacity-20 transition-all active:scale-95 shadow-soft">
                  <ChevronRight size={22} />
              </button>
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-5 space-y-4 pb-32">
         {mobileItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-40 text-slate-200">
                <Search size={72} className="opacity-10 mb-6" />
                <div className="text-center text-slate-400 font-extrabold uppercase tracking-widest italic opacity-40 text-sm">No items found.</div>
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
              className="w-full py-8 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] hover:bg-white hover:text-brand-600 transition-all bg-white shadow-soft active:scale-[0.98]"
            >
               Scroll For More ({filteredItems.length - mobileLimit} left)
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;