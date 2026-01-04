
import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory, toggleArchiveStatus } from '../services/inventoryService';
import { createStockRequests } from '../services/requestService';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Archive, 
  ArchiveRestore, 
  Loader2, 
  Eye, 
  History, 
  Clock, 
  ArrowRight, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Calendar,
  ClipboardPlus,
  Check,
  Lock,
  Box
} from 'lucide-react';

const formatQty = (n: number) => {
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return isNeg ? `-${str}` : str;
};

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
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock size={14} strokeWidth={2.5} />
           </div>
           <div>
              <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">Audit Trail</h4>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pricing Ledger</p>
           </div>
        </div>
        <span className="text-[9px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 ring-1 ring-slate-200/50">
           {history.length} RECORDS
        </span>
      </div>

      {loadingHistory ? (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin text-indigo-500" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Loading...</span>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-2 overflow-y-auto no-scrollbar pr-1 flex-1 max-h-[250px]">
          {history.map((entry) => {
            const isIncrease = entry.newPrice > entry.oldPrice;
            const percentChange = entry.oldPrice > 0 
               ? (((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1) 
               : '0.0';

            return (
              <div key={entry.id} className={`p-3 rounded-xl border transition-all ${isIncrease ? 'bg-rose-50/30 border-rose-100/60' : 'bg-teal-50/30 border-teal-100/60'}`}>
                 <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                       <Calendar size={10} className="text-slate-400" />
                       <span className="text-[10px] font-bold text-slate-500">
                          {new Date(entry.changeDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                       </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight ${isIncrease ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                       {isIncrease ? '+' : ''}{percentChange}%
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">Old</span>
                       <span className="text-[12px] font-bold text-slate-400 line-through">₹{entry.oldPrice}</span>
                    </div>
                    <ArrowRight size={12} className="text-slate-300" />
                    <div className="flex flex-col text-right">
                       <span className="text-[8px] font-bold text-indigo-500 uppercase">New</span>
                       <span className="text-[14px] font-bold text-slate-900 tracking-tight">₹{entry.newPrice}</span>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
           <History size={24} className="text-slate-200 mx-auto mb-2 opacity-50" />
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No history</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`} ref={triggerRef}>
      <div 
        onClick={visible ? (isMobile ? undefined : handleToggleHistory) : handleReveal}
        className={`group/price relative flex items-center gap-2 p-1 rounded-lg transition-all duration-300 cursor-pointer ${
          visible 
            ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800' 
            : 'bg-slate-50 text-slate-300 hover:bg-white hover:text-slate-500 hover:shadow-soft border border-slate-100'
        }`}
      >
        {!visible ? (
          <>
            <div className="px-1.5 py-0.5 font-bold text-sm blur-[6px] select-none tracking-tight opacity-20">₹88,888</div>
            <div className="bg-white p-1 rounded-md text-slate-300 shadow-etched group-hover/price:text-brand-600 transition-colors">
              <Eye size={12} strokeWidth={2.5} />
            </div>
          </>
        ) : (
          <>
            <div className="pl-2 pr-1 font-bold text-sm tracking-tight py-0.5">₹{price.toLocaleString()}</div>
            {isOwner && !isMobile && (
                <div 
                  onClick={handleToggleHistory}
                  className={`p-1 rounded-md transition-all active:scale-90 ${showHistory ? 'bg-indigo-600 text-white shadow-inner' : 'bg-indigo-50/10 text-white hover:bg-indigo-400'}`}
                >
                  <History size={12} strokeWidth={3} />
                </div>
            )}
            {isManager && <Lock size={10} className="text-white/40 mr-1" />}
          </>
        )}
      </div>

      {!isMobile && showHistory && isOwner && (
        <div 
          ref={popoverRef}
          className={`absolute ${flipPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'} ${align === 'right' ? 'right-0' : 'left-0'} z-[600] w-64 bg-white rounded-2xl shadow-elevated border border-slate-200/60 p-5 animate-slide-up overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
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
    onQuickRequest: (pn: string) => void;
}

const SwipeableMobileItem: React.FC<SwipeableItemProps> = ({ item, userRole, shouldHidePrice, isSelected, toggleSelect, enableSelection, onQuickRequest }) => {
    const navigate = useNavigate();
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipedOpen, setSwipedOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const maxSwipe = -140; 

    const onTouchStart = (e: React.TouchEvent) => {
        if (enableSelection && userRole === Role.OWNER) {
            const touchX = e.touches[0].clientX;
            if (touchX < 60) return; 
        }
        setStartX(e.touches[0].clientX);
        setIsSwiping(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;
        let newX = swipedOpen ? diff + maxSwipe : diff;
        if (newX > 0) newX = 0;
        if (newX < maxSwipe - 20) newX = maxSwipe - 20;
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
        <div className="relative overflow-visible rounded-2xl animate-fade-in group">
            <div className="absolute inset-0 flex justify-end rounded-2xl overflow-hidden bg-slate-50">
                <div className="flex h-full">
                    <button 
                        onClick={() => onQuickRequest(item.partNumber)}
                        className="bg-indigo-600 text-white w-[70px] flex flex-col items-center justify-center gap-1 shadow-inner active:bg-indigo-700 transition-colors"
                    >
                        <ClipboardPlus size={18} />
                        <span className="text-[8px] font-black uppercase tracking-wider">Req</span>
                    </button>
                    <button 
                        onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
                        className="bg-slate-900 text-white w-[70px] flex flex-col items-center justify-center gap-1 shadow-inner border-l border-white/5 active:bg-black transition-colors"
                    >
                        <Eye size={18} />
                        <span className="text-[8px] font-black uppercase tracking-wider">Details</span>
                    </button>
                </div>
            </div>

            <div 
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ transform: `translateX(${currentX}px)` }}
                className={`relative bg-white border border-slate-200/80 p-5 rounded-2xl shadow-soft transition-all duration-300 ease-out z-10 flex flex-col gap-4 ${isZero ? 'bg-slate-50/50' : ''} ${isSelected ? 'ring-2 ring-brand-500 bg-brand-50 border-brand-200 shadow-premium' : ''}`}
            >
                <div className="flex gap-4 items-start">
                    {enableSelection && userRole === Role.OWNER && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }}
                            className="flex-none pt-1 active:scale-90 transition-transform"
                        >
                            {isSelected ? <CheckSquare className="text-brand-600" size={22} /> : <Square className="text-slate-200" size={22} />}
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1 pr-2 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`flex-none text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest shadow-sm ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {item.brand.slice(0,3)}
                                    </span>
                                    <span className="font-black text-slate-900 text-[17px] leading-none tracking-tight truncate">
                                        {item.partNumber}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-semibold truncate leading-snug">{item.name}</p>
                            </div>
                            <div className="text-right flex flex-col items-end flex-none ml-2">
                                <div className={`font-black text-xl leading-none tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                    {formatQty(item.quantity)}
                                    <span className="text-[9px] uppercase font-black text-slate-400 ml-1 tracking-widest">PCS</span>
                                </div>
                                {isLow && !isZero && <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">Refill Soon</span>}
                                {isZero && <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest mt-1">Out Stock</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                        {userRole === Role.OWNER && (
                            <button 
                                onClick={toggleMobileHistory}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${showHistory ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-white'}`}
                            >
                                Audit
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-40">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</span>
                       <ChevronRight size={14} className="text-slate-400" />
                    </div>
                </div>
            </div>
        </div>
    );
};

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
  const [requestingPn, setRequestingPn] = useState<string | null>(null);

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

  const handleQuickRequest = async (pn: string) => {
      const qtyStr = window.prompt(`Requisition for ${pn}:\nEnter quantity needed:`, "5");
      if (qtyStr === null) return;
      const qty = parseInt(qtyStr);
      if (isNaN(qty) || qty <= 0) return alert("Please enter a valid quantity (positive number).");

      setRequestingPn(pn);
      try {
        const res = await createStockRequests([{
            partNumber: pn,
            quantity: qty,
            requesterName: userRole || 'System User'
        }]);
        if (res.success) {
            alert(`Requisition for ${qty} units of ${pn} recorded.`);
        } else {
            alert("Submission failed: " + res.message);
        }
      } catch (e: any) {
        alert("Policy Error: Please ensure database permissions are set. " + e.message);
      } finally {
        setRequestingPn(null);
      }
  };

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
      if (sortConfig?.key !== col) return <ArrowUpDown size={10} className="opacity-10" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-brand-600" /> : <ArrowDown size={10} className="text-brand-600" />;
  };

  return (
    <div className="bg-white rounded-3xl shadow-soft border border-slate-200/50 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex items-center gap-3">
               <h2 className="font-black text-slate-900 text-lg tracking-tight">{title || 'Stock Catalog'}</h2>
               <span className="bg-white text-slate-400 ring-1 ring-slate-200 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-inner-soft">{filteredItems.length} records</span>
            </div>
            
            <div className="flex items-center gap-3">
                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="hidden md:flex bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all items-center gap-1.5 shadow-sm ring-1 ring-rose-200/40"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={12} /> : null}
                        Archive ({selectedParts.size})
                    </button>
                )}

                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={16} />
                    <input 
                    type="text" 
                    placeholder="Search ledger..." 
                    className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-brand-500/5 focus:border-brand-300 w-full md:w-64 transition-all shadow-inner-soft outline-none"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`hidden md:flex p-2.5 rounded-xl border transition-all shadow-sm ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                        {showArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {enableActions && isOwner && (
        <div className="md:hidden p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
           <button 
             onClick={toggleSelectPage}
             className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm active:scale-95"
           >
              {isAllMobileSelected ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} className="text-slate-200" />}
              Batch Select
           </button>
           {selectedParts.size > 0 && <span className="text-[9px] font-black text-white bg-brand-600 px-3 py-1.5 rounded-xl shadow-md">{selectedParts.size} Active</span>}
        </div>
      )}

      {enableActions && isOwner && selectedParts.size > 0 && (
        <div className="bg-slate-900 p-4 text-center text-[12px] text-white animate-slide-up flex flex-col md:flex-row items-center justify-center gap-6 shadow-2xl border-t border-white/5">
           <p className="font-black tracking-widest uppercase text-[10px]">
             {isAllFilteredSelected 
               ? `Full batch of ${filteredItems.length} items ready.` 
               : `${selectedParts.size} entries in session.`
             }
           </p>
           <div className="flex gap-5">
             {((window.innerWidth >= 768 && isAllPageSelected) || (window.innerWidth < 768 && isAllMobileSelected)) && !isAllFilteredSelected && filteredItems.length > (window.innerWidth < 768 ? mobileLimit : currentItems.length) && (
               <button onClick={toggleSelectAllFiltered} className="underline font-black text-brand-400 hover:text-brand-300 uppercase text-[10px] tracking-widest">
                 Select All {filteredItems.length}
               </button>
             )}
             <button onClick={() => setSelectedParts(new Set())} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 ring-white/10 transition-all">Dismiss</button>
           </div>
        </div>
      )}

      <div className="hidden md:block overflow-visible">
        <table className="w-full text-left text-[13.5px] border-collapse">
            <thead className="bg-slate-50/50 backdrop-blur-md sticky top-0 z-[400] shadow-sm">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-6 py-5 w-12">
                            <button 
                              onClick={toggleSelectPage} 
                              className="text-slate-200 hover:text-brand-600 transition-all"
                            >
                              {isAllPageSelected ? <CheckSquare className="text-brand-600" size={20} /> : isPartiallySelected ? <MinusSquare className="text-brand-600" size={20} /> : <Square size={20} />}
                            </button>
                        </th>
                    )}
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[9px] cursor-pointer group/h" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[9px] cursor-pointer group/h" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[9px] text-center w-28">Brand</th>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[9px] text-center cursor-pointer group/h" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-2 group-hover/h:text-slate-600 transition-colors">In-Stock <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[9px] text-right cursor-pointer group/h" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-2 group-hover/h:text-slate-600 transition-colors">MRP Rate <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-6 py-5 text-center text-slate-400 font-black uppercase tracking-[0.15em] text-[9px] w-28">Operations</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-24 text-center text-slate-300 font-bold text-base italic tracking-tight">No matching records found.</td></tr>
                ) : (
                    currentItems.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);
                        const isBeingRequested = requestingPn === item.partNumber;

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50/40 transition-colors ${isSelected ? 'bg-brand-50/40' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                          <input 
                                              type="checkbox" 
                                              checked={isSelected} 
                                              onChange={() => toggleSelect(item.partNumber)}
                                              className="w-4.5 h-4.5 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500/20 shadow-sm" 
                                          />
                                        </div>
                                    </td>
                                )}
                                <td className="px-6 py-4">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-900 hover:text-brand-600 transition-colors tracking-tight text-[15px] uppercase">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black bg-rose-50 text-rose-500 border border-rose-100 uppercase tracking-widest shadow-sm">Out</span>}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-semibold leading-relaxed line-clamp-1 h-[54px] flex items-center">{item.name}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-soft ring-1 ring-slate-200/40 ${item.brand === Brand.HYUNDAI ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                        {item.brand.slice(0,3)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className={`font-black text-[16px] tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                            {formatQty(item.quantity)}
                                        </span>
                                        {isLow && !isZero && <span className="text-[7px] font-black text-amber-600/60 uppercase tracking-widest">Crit.</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} />
                                </td>
                                {enableActions && (
                                    <td className="px-6 py-4 text-center">
                                         <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleQuickRequest(item.partNumber)}
                                                disabled={isBeingRequested}
                                                className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90 border border-transparent hover:border-indigo-100 shadow-sm"
                                                title="Quick Requisition"
                                            >
                                                {isBeingRequested ? <Loader2 size={16} className="animate-spin"/> : <ClipboardPlus size={16} strokeWidth={2.5} />}
                                            </button>
                                            <Link 
                                                to={`/item/${encodeURIComponent(item.partNumber)}`} 
                                                className="text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all p-2.5 rounded-xl inline-block border border-transparent hover:border-brand-100 shadow-sm"
                                                title="View Details"
                                            >
                                                <Eye size={16} strokeWidth={2.5} />
                                            </Link>
                                         </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md sticky bottom-0 z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.02)] rounded-b-3xl">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Register {currentPage} / {totalPages}</span>
          <div className="flex gap-3">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all shadow-soft flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                  <ChevronLeft size={16} strokeWidth={3} /> Prev
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all shadow-soft flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                  Next <ChevronRight size={16} strokeWidth={3} />
              </button>
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-4 space-y-4 pb-40">
         {mobileItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 text-slate-200">
                <Search size={64} className="opacity-10 mb-6" />
                <div className="text-center text-slate-400 font-black uppercase tracking-[0.25em] italic text-[11px]">No items found.</div>
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
                    onQuickRequest={handleQuickRequest}
                />
             ))
         )}
         {mobileLimit < filteredItems.length && (
            <button 
              onClick={() => setMobileLimit(prev => prev + 20)}
              className="w-full py-8 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] hover:bg-white hover:text-brand-600 transition-all bg-white shadow-soft active:scale-[0.99]"
            >
               Browse {filteredItems.length - mobileLimit} More
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;
