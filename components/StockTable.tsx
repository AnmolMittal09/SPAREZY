
import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory, updateOrAddItems } from '../services/inventoryService';
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
  Lock,
  Box,
  Edit3,
  Check,
  Download,
  ChevronRight as ChevronRightIcon,
  X,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

const fd = (n: number | string) => {
    const num = parseInt(n.toString()) || 0;
    return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

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
    if (!visible) setVisible(true);
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
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Audit Trail</h4>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Rate Change Log</p>
           </div>
        </div>
        <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 ring-1 ring-slate-200/50">
           {formatQty(history.length)} RECORDS
        </span>
      </div>

      {loadingHistory ? (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin text-indigo-50" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scanning Ledger</span>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-2 overflow-y-auto no-scrollbar pr-1 flex-1 max-h-[250px]">
          {history.map((entry) => {
            const isIncrease = entry.newPrice > entry.oldPrice;
            return (
              <div key={entry.id} className={`p-3 rounded-xl border transition-all ${isIncrease ? 'bg-rose-50/30 border-rose-100/60' : 'bg-teal-50/30 border-teal-100/60'}`}>
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                       {new Date(entry.changeDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </span>
                    <div className={`px-1.5 py-0.5 rounded uppercase text-[8px] font-black ${isIncrease ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                       {isIncrease ? 'UP' : 'DOWN'}
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-400 line-through">₹{entry.oldPrice}</span>
                    <ArrowRight size={12} className="text-slate-300" />
                    <span className="text-[14px] font-black text-slate-900 tracking-tight">₹{entry.newPrice}</span>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No history recorded</p>
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
            <div className="pl-2 pr-1 font-black text-sm tracking-tight py-0.5">₹{price.toLocaleString()}</div>
            {isOwner && !isMobile && (
                <div 
                  onClick={handleToggleHistory}
                  className={`p-1 rounded-md transition-all active:scale-90 ${showHistory ? 'bg-indigo-600 text-white shadow-inner' : 'bg-white/10 text-white hover:bg-indigo-400'}`}
                >
                  <History size={12} strokeWidth={3} />
                </div>
            )}
            {isManager && <Lock size={10} className="text-white/30 mr-1" />}
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
    isEditMode?: boolean;
    onInlineUpdate?: (pn: string, qty: number) => void;
    isUpdating?: boolean;
}

const SwipeableMobileItem: React.FC<SwipeableItemProps> = ({ 
    item, userRole, shouldHidePrice, isSelected, toggleSelect, enableSelection, 
    onQuickRequest, isEditMode, onInlineUpdate, isUpdating 
}) => {
    const navigate = useNavigate();
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipedOpen, setSwipedOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [localQty, setLocalQty] = useState<string>(item.quantity.toString());

    useEffect(() => {
        setLocalQty(item.quantity.toString());
    }, [item.quantity]);

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
                                    <span className="font-black text-slate-900 text-[17px] leading-none tracking-tight truncate uppercase">
                                        {item.partNumber}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-semibold truncate leading-snug uppercase tracking-tight">{item.name}</p>
                            </div>
                            <div className="text-right flex flex-col items-end flex-none ml-2">
                                {isEditMode && userRole === Role.OWNER ? (
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner-soft focus-within:border-indigo-400 transition-all">
                                            <input 
                                                type="number"
                                                className="w-16 bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-base font-black text-slate-900 text-center outline-none focus:ring-4 focus:ring-indigo-500/5"
                                                value={localQty}
                                                onChange={(e) => setLocalQty(e.target.value)}
                                            />
                                            <button 
                                                onClick={() => onInlineUpdate?.(item.partNumber, parseInt(localQty) || 0)}
                                                disabled={isUpdating}
                                                className="p-2 ml-1 bg-indigo-600 text-white rounded-lg active:scale-90 transition-all disabled:opacity-30 shadow-sm"
                                            >
                                                {isUpdating ? <Loader2 size={14} className="animate-spin"/> : <Check size={14} strokeWidth={4} />}
                                            </button>
                                        </div>
                                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] mr-1">COMMIT STOCK</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`font-black text-xl leading-none tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                            {formatQty(item.quantity)}
                                            <span className="text-[9px] uppercase font-black text-slate-400 ml-1 tracking-widest">PCS</span>
                                        </div>
                                        {isLow && !isZero && <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">Refill Soon</span>}
                                        {isZero && <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest mt-1">Out Stock</span>}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                        {userRole === Role.OWNER && !isEditMode && (
                            <button 
                                onClick={toggleMobileHistory}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${showHistory ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-white'}`}
                            >
                                Audit
                            </button>
                        )}
                    </div>
                    {!isEditMode && (
                        <div className="flex items-center gap-1.5 opacity-40">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</span>
                           <ChevronRightIcon size={14} className="text-slate-400" />
                        </div>
                    )}
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [updatingPn, setUpdatingPn] = useState<string | null>(null);
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});

  const isOwner = userRole === Role.OWNER;
  const isManager = userRole === Role.MANAGER;
  const effectiveSearch = externalSearch !== undefined ? (externalSearch || internalSearch) : internalSearch;

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
  const isPartiallySelected = selectedParts.size > 0 && !isAllPageSelected;

  const handleExport = () => {
    const dataToExport = filteredItems.map(item => ({
      'Part Number': item.partNumber,
      'Description': item.name,
      'Brand': item.brand,
      'HSN Code': item.hsnCode,
      'Quantity': item.quantity,
      'MRP Price': item.price
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Sparezy_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleQuickRequest = async (pn: string) => {
      const qtyStr = window.prompt(`Requisition for ${pn}:\nEnter quantity needed:`, "05");
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
        if (res.success) alert(`Requisition for ${formatQty(qty)} units of ${pn} recorded.`);
        else alert("Submission failed: " + res.message);
      } catch (e: any) {
        alert("Database Error: Ensure permissions are set. " + e.message);
      } finally {
        setRequestingPn(null);
      }
  };

  const handleInlineQtyUpdate = async (pn: string, customQty?: number) => {
      const newQty = customQty !== undefined ? customQty : editedQtys[pn];
      if (newQty === undefined) return;
      
      setUpdatingPn(pn);
      try {
          const result = await updateOrAddItems([{ partNumber: pn, quantity: newQty }]);
          if (result.errors.length > 0) {
              alert("Error updating: " + result.errors[0]);
          } else {
              window.location.reload(); 
          }
      } catch (e) {
          alert("Failed to update stock quantity.");
      } finally {
          setUpdatingPn(null);
      }
  };

  const toggleSelectPage = () => {
    const newSet = new Set(selectedParts);
    const itemsToToggle = window.innerWidth < 768 ? mobileItems : currentItems;
    const isCurrentlySelected = window.innerWidth < 768 ? isAllMobileSelected : isAllPageSelected;

    if (isCurrentlySelected) itemsToToggle.forEach(i => newSet.delete(i.partNumber));
    else itemsToToggle.forEach(i => newSet.add(i.partNumber));
    setSelectedParts(newSet);
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
      if (!confirm(`Archive ${formatQty(selectedParts.size)} items?`)) return;
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
      return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-blue-600" /> : <ArrowDown size={10} className="text-blue-600" />;
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/50 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/20">
            <div className="flex items-center gap-3">
               <h2 className="font-black text-slate-900 text-lg tracking-tight">{title || 'Stock Registry'}</h2>
               <span className="bg-white text-slate-400 ring-1 ring-slate-200 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-inner-soft">{formatQty(filteredItems.length)} records</span>
            </div>
            
            <div className="flex items-center gap-3">
                {isOwner && (
                    <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ring-1 ${
                            isEditMode 
                                ? 'bg-indigo-600 text-white border-indigo-700 ring-indigo-400' 
                                : 'bg-white text-indigo-600 border-slate-200 hover:bg-indigo-50 ring-transparent'
                        }`}
                    >
                        {isEditMode ? <X size={16} strokeWidth={3} /> : <Edit3 size={16} strokeWidth={3} />}
                        {isEditMode ? 'Exit' : 'Edit Mode'}
                    </button>
                )}

                <button 
                    onClick={handleExport}
                    className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                    title="Export to Excel"
                >
                    <Download size={20} />
                </button>

                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="hidden md:flex bg-rose-50 text-rose-600 hover:bg-rose-100 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all items-center gap-2 shadow-sm ring-1 ring-rose-200/40"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={14} /> : null}
                        Archive ({formatQty(selectedParts.size)})
                    </button>
                )}

                <div className="relative group hidden md:block">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                    type="text" 
                    placeholder="Quick Filter..." 
                    className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-300 w-64 transition-all shadow-inner-soft outline-none"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`hidden md:flex p-3 rounded-2xl border transition-all shadow-sm ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                        {showArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {enableActions && isOwner && (
        <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50/30 border-b border-slate-100">
           {/* Mobile Search Bar */}
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
              <input 
                 type="text" 
                 placeholder="Search part no, name..." 
                 className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-soft outline-none focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300 uppercase tracking-tight"
                 value={internalSearch}
                 onChange={e => setInternalSearch(e.target.value)}
              />
           </div>
           
           <div className="flex items-center justify-between gap-3">
              <button 
                onClick={toggleSelectPage}
                className="flex-1 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm active:scale-95"
              >
                 {isAllMobileSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-slate-200" />}
                 Select
              </button>
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex-1 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] px-5 py-3.5 rounded-2xl border shadow-sm active:scale-95 transition-all ${
                  isEditMode ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-slate-200'
                }`}
              >
                 {isEditMode ? <X size={18} /> : <Edit3 size={18} />}
                 {isEditMode ? 'Exit' : 'Edit'}
              </button>
           </div>
        </div>
      )}

      <div className="hidden md:block overflow-visible">
        <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-slate-50/50 backdrop-blur-md sticky top-0 z-[400] shadow-sm">
                <tr className="border-b border-slate-100">
                    {enableActions && isOwner && (
                        <th className="px-8 py-5 w-12 text-center">
                            <button onClick={toggleSelectPage} className="text-slate-200 hover:text-blue-600 transition-all">
                              {isAllPageSelected ? <CheckSquare className="text-blue-600" size={20} /> : isPartiallySelected ? <MinusSquare className="text-blue-600" size={20} /> : <Square size={20} />}
                            </button>
                        </th>
                    )}
                    <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] cursor-pointer group/h" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors uppercase">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] cursor-pointer group/h" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-2 group-hover/h:text-slate-600 transition-colors uppercase">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] text-center w-32 uppercase">Brand</th>
                    <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] text-center cursor-pointer group/h" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-2 group-hover/h:text-slate-600 transition-colors uppercase">On-Hand <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.2em] text-[9px] text-right cursor-pointer group/h" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-2 group-hover/h:text-slate-600 transition-colors uppercase">MRP Rate <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-8 py-5 text-center text-slate-400 font-black uppercase tracking-[0.2em] text-[9px] w-32 uppercase">Process</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-32 text-center text-slate-300 font-black text-base italic tracking-tight opacity-40">No entries found in registry.</td></tr>
                ) : (
                    currentItems.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);
                        const isBeingRequested = requestingPn === item.partNumber;
                        const isUpdating = updatingPn === item.partNumber;

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-8 py-5 text-center">
                                          <input 
                                              type="checkbox" 
                                              checked={isSelected} 
                                              onChange={() => toggleSelect(item.partNumber)}
                                              className="w-4.5 h-4.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 shadow-sm" 
                                          />
                                    </td>
                                )}
                                <td className="px-8 py-5">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-900 hover:text-blue-600 transition-colors tracking-tight text-[15px] uppercase">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black bg-rose-50 text-rose-500 border border-rose-100 uppercase tracking-widest shadow-sm">Out</span>}
                                </td>
                                <td className="px-8 py-5 text-slate-600 font-semibold leading-relaxed max-w-[240px] truncate uppercase tracking-tight">{item.name}</td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-soft ring-1 ring-slate-200/40 ${item.brand === Brand.HYUNDAI ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                        {item.brand.slice(0,3)}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <div className="flex flex-col items-center">
                                        {isEditMode && isOwner ? (
                                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-inner-soft group/edit-cell focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
                                                <input 
                                                    type="number"
                                                    disabled={isUpdating}
                                                    defaultValue={item.quantity}
                                                    className="w-16 bg-white border border-slate-200 rounded-lg py-1 px-2 text-[15px] font-black text-slate-900 outline-none disabled:opacity-50"
                                                    onChange={(e) => setEditedQtys({...editedQtys, [item.partNumber]: parseInt(e.target.value) || 0})}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleInlineQtyUpdate(item.partNumber);
                                                        if (e.key === 'Escape') setIsEditMode(false);
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => handleInlineQtyUpdate(item.partNumber)}
                                                    disabled={isUpdating || editedQtys[item.partNumber] === undefined}
                                                    className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 transition-all active:scale-90 shadow-sm"
                                                >
                                                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={4} />}
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className={`font-black text-[16px] tracking-tighter ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                                                    {formatQty(item.quantity)}
                                                </span>
                                                {isLow && !isZero && <span className="text-[7px] font-black text-amber-600/50 uppercase tracking-widest">Low</span>}
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} />
                                </td>
                                {enableActions && (
                                    <td className="px-8 py-5 text-center">
                                         <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <button 
                                                onClick={() => handleQuickRequest(item.partNumber)}
                                                disabled={isBeingRequested}
                                                className="p-3 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 active:scale-90"
                                            >
                                                {isBeingRequested ? <Loader2 size={16} className="animate-spin"/> : <ClipboardPlus size={18} strokeWidth={2.5} />}
                                            </button>
                                            <Link 
                                                to={`/item/${encodeURIComponent(item.partNumber)}`} 
                                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-3 rounded-xl transition-all border border-transparent hover:border-blue-100 active:scale-90"
                                            >
                                                <Eye size={18} strokeWidth={2.5} />
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
        
        <div className="px-10 py-6 border-t border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md sticky bottom-0 z-[100] rounded-b-[2.5rem] shadow-inner-soft">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Register {fd(currentPage)} of {fd(totalPages)}</span>
          <div className="flex gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all shadow-soft flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                  <ChevronLeft size={16} strokeWidth={3} /> Prev
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all shadow-soft flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                  Next <ChevronRight size={16} strokeWidth={3} />
              </button>
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-4 space-y-4 pb-40">
         {mobileItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 text-slate-200">
                <Search size={64} className="opacity-10 mb-6" />
                <div className="text-center text-slate-400 font-black uppercase tracking-[0.3em] italic text-[11px]">Database is empty</div>
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
                    isEditMode={isEditMode}
                    onInlineUpdate={handleInlineQtyUpdate}
                    isUpdating={updatingPn === item.partNumber}
                />
             ))
         )}
         {mobileLimit < filteredItems.length && (
            <button 
              onClick={() => setMobileLimit(prev => prev + 20)}
              className="w-full py-8 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] hover:bg-white hover:text-blue-600 transition-all bg-white shadow-soft active:scale-[0.99]"
            >
               Browse {formatQty(filteredItems.length - mobileLimit)} More
            </button>
         )}
      </div>
    </div>
  );
};

export default StockTable;
