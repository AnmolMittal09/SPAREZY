
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry, RequestStatus } from '../types';
import { bulkArchiveItems, fetchPriceHistory, updateOrAddItems } from '../services/inventoryService';
import { createStockRequests } from '../services/requestService';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Archive, 
  ArchiveRestore, 
  Eye, 
  History, 
  Clock, 
  CheckSquare, 
  Square, 
  ClipboardPlus, 
  Download,
  CheckCircle2,
  MousePointerClick,
  Loader2,
  Check,
  Edit3,
  Lock,
  Unlock,
  Save,
  AlertCircle
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

const PriceCell: React.FC<{ price: number; partNumber: string; userRole?: Role; align?: 'left' | 'right' }> = React.memo(({ price, partNumber, userRole, align = 'right' }) => {
  const [visible, setVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isOwner = userRole === Role.OWNER;
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768;

  const loadHistory = async () => {
    if (history.length > 0 || loadingHistory) return;
    setLoadingHistory(true);
    try { const data = await fetchPriceHistory(partNumber); setHistory(data || []); } catch (err) { } finally { setLoadingHistory(false); }
  };

  const handleReveal = async (e: React.MouseEvent) => { e.stopPropagation(); if (visible) return; setVisible(true); if (isOwner) await loadHistory(); };
  const handleToggleHistory = async (e: React.MouseEvent) => { e.stopPropagation(); if (!visible) setVisible(true); await loadHistory(); setShowHistory(!showHistory); };

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`}>
      <div 
        onClick={visible ? (isMobile ? undefined : handleToggleHistory) : handleReveal}
        className={`group/price flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
          visible ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-300 border-slate-200/80 hover:border-slate-300'
        }`}
      >
        {!visible ? (
          <>
            <div className="px-2 py-0.5 font-black text-sm blur-[8px] select-none tracking-tight opacity-30">₹88,888</div>
            <Eye size={14} strokeWidth={3} className="text-slate-400" />
          </>
        ) : (
          <>
            <div className="pl-2 pr-1 font-black text-[15px] tracking-tight py-0.5">₹{price.toLocaleString()}</div>
            {isOwner && !isMobile && <History size={14} strokeWidth={3} className="text-blue-400 ml-1" />}
          </>
        )}
      </div>

      {showHistory && isOwner && !isMobile && (
        <div ref={popoverRef} className="absolute bottom-full mb-3 right-0 z-[600] w-64 bg-white rounded-xl shadow-md border border-slate-200/80 p-4 animate-slide-up">
           <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-slate-900" />
              <h4 className="text-[11px] font-black text-slate-900 uppercase">Price Audit Trail</h4>
           </div>
           <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {history.map(h => (
                <div key={h.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-[12px] font-bold">
                   <span className="text-slate-500">{new Date(h.changeDate).toLocaleDateString()}</span>
                   <span className="text-slate-950">₹{h.newPrice}</span>
                </div>
              ))}
              {history.length === 0 && <p className="text-center text-[10px] font-bold text-slate-400 py-4">No history records</p>}
           </div>
        </div>
      )}
    </div>
  );
});

const SwipeableMobileItem: React.FC<any> = React.memo(({ item, userRole, toggleSelect, isSelected, enableSelection, onQuickRequest, isEditMode, onDirectUpdate }) => {
    const navigate = useNavigate();
    const isZero = item.quantity === 0;
    const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;

    return (
        <div 
            onClick={() => { if(enableSelection && !isEditMode && userRole === Role.OWNER) toggleSelect(item.partNumber); }}
            className={`relative bg-white border p-4 rounded-xl shadow-sm transition-all duration-150 flex flex-col gap-3.5 ${isSelected ? 'border-blue-500 ring-2 ring-blue-50 bg-blue-50/10' : 'border-slate-200/80'} ${isZero ? 'bg-slate-50/50' : ''}`}
        >
            <div className="flex gap-4 items-start">
                {enableSelection && !isEditMode && userRole === Role.OWNER && (
                    <div className="flex-none pt-1">
                        {isSelected ? <CheckSquare className="text-blue-700" size={24} strokeWidth={3}/> : <Square className="text-slate-300" size={24} strokeWidth={2}/>}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-700' : 'bg-red-700'}`}>{item.brand.slice(0,3)}</span>
                            <span className="font-black text-slate-950 text-lg uppercase tracking-tight truncate">{item.partNumber}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            {isEditMode ? (
                                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <input 
                                        type="number"
                                        className="w-16 bg-white rounded-lg px-2 py-1 text-center font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        defaultValue={item.quantity}
                                        onBlur={(e) => onDirectUpdate(item.partNumber, parseInt(e.target.value) || 0)}
                                    />
                                    <Save size={14} className="text-slate-400 mr-1" />
                                </div>
                            ) : (
                                <span className={`text-xl font-black tabular-nums ${isZero ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-slate-950'}`}>
                                    {formatQty(item.quantity)} <span className="text-[10px] uppercase font-extrabold text-slate-500 ml-0.5">PCS</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 font-bold uppercase tracking-tight leading-snug line-clamp-1">{item.name}</p>
                </div>
            </div>
            <div className="pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/item/${encodeURIComponent(item.partNumber)}`); }} className="p-2.5 bg-slate-100 text-slate-900 rounded-xl active:scale-90 border border-slate-200"><Eye size={18} strokeWidth={2.5}/></button>
                    {!isEditMode && (
                        <button onClick={(e) => { e.stopPropagation(); onQuickRequest(item.partNumber); }} className="p-2.5 bg-blue-700 text-white rounded-xl active:scale-90 shadow-lg"><ClipboardPlus size={18} strokeWidth={2.5}/></button>
                    )}
                </div>
            </div>
        </div>
    );
});

const StockTable: React.FC<any> = ({ items, title, userRole, userName, enableActions = true, externalSearch, hideToolbar = false, stockStatusFilter = 'ALL', hidePriceByDefault = false, disableSelection = false, brandFilter }) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<any>({ key: 'partNumber', direction: 'asc' });
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<StockItem[]>(items);

  const isOwner = userRole === Role.OWNER;
  const effectiveSearch = externalSearch !== undefined ? (externalSearch || internalSearch) : internalSearch;

  // Sync internal state when items prop changes
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = localItems.filter(item => {
        if (!showArchived && item.isArchived) return false;
        if (showArchived && !item.isArchived) return false;
        if (brandFilter && item.brand !== brandFilter) return false;
        if (stockStatusFilter === 'LOW' && (item.quantity === 0 || item.quantity >= item.minStockThreshold)) return false;
        if (stockStatusFilter === 'OUT' && item.quantity > 0) return false;
        if (effectiveSearch) {
            const lower = effectiveSearch.toLowerCase();
            return item.partNumber.toLowerCase().includes(lower) || item.name.toLowerCase().includes(lower);
        }
        return true;
    });
    if (sortConfig) {
        result.sort((a, b) => {
            const aVal = a[sortConfig.key] ?? 0; const bVal = b[sortConfig.key] ?? 0;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return result;
  }, [localItems, effectiveSearch, showArchived, sortConfig, stockStatusFilter, brandFilter]);

  const currentItems = filteredItems.slice((currentPage - 1) * 50, currentPage * 50);

  const handleQuickRequest = async (partNumber: string) => {
    setRequestingId(partNumber);
    try {
      const res = await createStockRequests([{
        partNumber: partNumber,
        quantity: 5, // Default reorder quantity
        requesterName: userName || 'User'
      }]);
      if (res.success) {
        setTimeout(() => setRequestingId(null), 1000);
      } else {
        alert("Failed to create request: " + res.message);
        setRequestingId(null);
      }
    } catch (err) {
      alert("Error processing request");
      setRequestingId(null);
    }
  };

  const handleDirectUpdate = async (partNumber: string, newQty: number) => {
    // Optimization: Update local state immediately for UI responsiveness
    setLocalItems(prev => prev.map(item => item.partNumber === partNumber ? { ...item, quantity: newQty } : item));
    
    try {
      await updateOrAddItems([{ partNumber, quantity: newQty }]);
    } catch (err) {
      console.error("Ledger Sync Failed", err);
    }
  };

  const toggleSelect = useCallback((pn: string) => {
    if (disableSelection || isEditMode) return;
    setSelectedParts(prev => { const n = new Set(prev); if (n.has(pn)) n.delete(pn); else n.add(pn); return n; });
  }, [disableSelection, isEditMode]);

  const isAllOnPageSelected = useMemo(() => {
    if (disableSelection || isEditMode) return false;
    return currentItems.length > 0 && currentItems.every(i => selectedParts.has(i.partNumber));
  }, [currentItems, selectedParts, disableSelection, isEditMode]);

  const isTrulyAllSelected = useMemo(() => {
    if (disableSelection || isEditMode) return false;
    return filteredItems.length > 0 && filteredItems.length === selectedParts.size;
  }, [filteredItems, selectedParts, disableSelection, isEditMode]);

  const toggleSelectPage = () => {
    if (disableSelection || isEditMode) return;
    if (isAllOnPageSelected) {
      setSelectedParts(prev => {
        const next = new Set(prev);
        currentItems.forEach(i => next.delete(i.partNumber));
        return next;
      });
    } else {
      setSelectedParts(prev => {
        const next = new Set(prev);
        currentItems.forEach(i => next.add(i.partNumber));
        return next;
      });
    }
  };

  const selectTrulyAll = () => {
    if (disableSelection || isEditMode) return;
    const next = new Set<string>();
    filteredItems.forEach(i => next.add(i.partNumber));
    setSelectedParts(next);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredItems.map(i => ({ SKU: i.partNumber, Name: i.name, Stock: i.quantity, Price: i.price })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Sparezy_Inventory.xlsx`);
  };

  const handleBulkArchive = async () => {
    if (disableSelection || selectedParts.size === 0) return;
    const action = showArchived ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} ${selectedParts.size} selected items?`)) return;
    
    try {
      await bulkArchiveItems(Array.from(selectedParts), !showArchived);
      setSelectedParts(new Set());
      window.location.reload();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="px-6 py-4.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
            <div className="flex items-center gap-4">
               <h2 className="font-bold text-slate-800 text-lg tracking-tight uppercase">{title || 'Registry Control'}</h2>
                <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">{formatQty(filteredItems.length)} items</span>
            </div>
            <div className="flex items-center gap-3">
                {isOwner && (
                    <button 
                        onClick={() => { setIsEditMode(!isEditMode); setSelectedParts(new Set()); }}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-sm border ${isEditMode ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                        {isEditMode ? <Unlock size={16} /> : <Lock size={16} />}
                        {isEditMode ? 'Edit Mode On' : 'Edit Mode'}
                    </button>
                )}
                {selectedParts.size > 0 && isOwner && !disableSelection && !isEditMode && (
                    <button 
                      onClick={handleBulkArchive}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-200 transition-all active:scale-95"
                    >
                      {showArchived ? <ArchiveRestore size={16}/> : <Archive size={16}/>}
                      {showArchived ? 'Restore' : 'Archive'} ({fd(selectedParts.size)})
                    </button>
                )}
                <button onClick={handleExport} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"><Download size={18} strokeWidth={2}/></button>
                <div className="relative group w-full md:w-auto flex-2 md:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={2} />
                    <input type="text" placeholder="SKU Search..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold w-full md:w-64 focus:border-slate-950 outline-none transition-all shadow-sm" value={internalSearch} onChange={e => setInternalSearch(e.target.value)}/>
                </div>
                {isOwner && (
                    <button onClick={() => setShowArchived(!showArchived)} className={`hidden md:flex p-2.5 rounded-xl border transition-all ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200 text-slate-550 hover:border-slate-300 hover:bg-slate-50'}`}>
                        {showArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {isOwner && isEditMode && (
        <div className="px-8 py-3 bg-amber-50 text-amber-800 flex items-center gap-3 border-b-2 border-amber-100 animate-fade-in">
            <AlertCircle size={18} />
            <span className="text-[11px] font-black uppercase tracking-widest">Master Ledger Override Active: You can now directly adjust stock quantities.</span>
        </div>
      )}

      {/* Bulk Select Feedback Banner */}
      {isOwner && !disableSelection && !isEditMode && isAllOnPageSelected && !isTrulyAllSelected && filteredItems.length > currentItems.length && (
        <div className="px-8 py-3 bg-blue-600 text-white flex items-center justify-between animate-fade-in border-b-2 border-blue-700">
           <div className="flex items-center gap-3">
              <CheckCircle2 size={18} />
              <span className="text-[12px] font-bold uppercase tracking-wide">All {currentItems.length} parts on this page are selected.</span>
           </div>
           <button 
             onClick={selectTrulyAll}
             className="px-4 py-1.5 bg-white text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg"
           >
             <MousePointerClick size={14} strokeWidth={3} />
             Select all {filteredItems.length} parts in inventory
           </button>
        </div>
      )}

      <div className="hidden md:block overflow-visible">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-900 sticky top-0 z-[100]">
                <tr>
                    {enableActions && isOwner && !disableSelection && !isEditMode && (
                        <th className="px-8 py-5 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={isAllOnPageSelected} 
                              onChange={toggleSelectPage} 
                              className="w-5 h-5 rounded border border-slate-350 text-blue-600 focus:ring-slate-950 transition-all cursor-pointer" 
                            />
                        </th>
                    )}
                    <th className="px-8 py-5 font-extrabold uppercase tracking-widest text-[11px] cursor-pointer" onClick={() => setSortConfig({key:'partNumber', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Part Number</th>
                    <th className="px-8 py-5 font-extrabold uppercase tracking-widest text-[11px] cursor-pointer" onClick={() => setSortConfig({key:'name', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Description</th>
                    <th className="px-8 py-5 font-extrabold uppercase tracking-widest text-[11px] text-center">Brand</th>
                    <th className="px-8 py-5 font-extrabold uppercase tracking-widest text-[11px] text-center cursor-pointer" onClick={() => setSortConfig({key:'quantity', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>Stock</th>
                    <th className="px-8 py-5 font-extrabold uppercase tracking-widest text-[11px] text-right">MRP Rate</th>
                    {enableActions && <th className="px-8 py-5 text-center text-[11px] font-extrabold uppercase tracking-widest">Actions</th>}
                </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
                {currentItems.map((item) => {
                    const isRequesting = requestingId === item.partNumber;
                    return (
                      <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${!disableSelection && !isEditMode && selectedParts.has(item.partNumber) ? 'bg-blue-50/60' : ''}`}>
                          {enableActions && isOwner && !disableSelection && !isEditMode && (
                              <td className="px-8 py-5 text-center">
                                  <input type="checkbox" checked={selectedParts.has(item.partNumber)} onChange={() => toggleSelect(item.partNumber)} className="w-5 h-5 rounded border border-slate-300 text-blue-600" />
                              </td>
                          )}
                          <td className="px-8 py-5"><Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-950 hover:text-blue-700 transition-colors tracking-tight text-[16px] uppercase">{item.partNumber}</Link></td>
                          <td className="px-8 py-5 text-slate-800 font-bold uppercase tracking-tight text-sm truncate max-w-xs">{item.name}</td>
                          <td className="px-8 py-5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-700' : 'bg-red-700'}`}>{item.brand.slice(0,3)}</span></td>
                          <td className="px-8 py-5 text-center">
                              {isEditMode ? (
                                  <div className="flex items-center justify-center gap-2">
                                      <input 
                                        type="number"
                                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-950 focus:border-blue-500 outline-none shadow-sm"
                                        defaultValue={item.quantity}
                                        onBlur={(e) => handleDirectUpdate(item.partNumber, parseInt(e.target.value) || 0)}
                                      />
                                      <Save size={16} className="text-slate-300" />
                                  </div>
                              ) : (
                                  <span className={`font-black text-[17px] tabular-nums ${item.quantity === 0 ? 'text-rose-700' : item.quantity <= item.minStockThreshold ? 'text-amber-700' : 'text-slate-950'}`}>{formatQty(item.quantity)}</span>
                              )}
                          </td>
                          <td className="px-8 py-5 text-right"><PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} /></td>
                          {enableActions && (
                              <td className="px-8 py-5 text-center">
                                  <div className="flex justify-center gap-2">
                                      {!isEditMode && (
                                          <button 
                                            onClick={() => handleQuickRequest(item.partNumber)} 
                                            className={`p-2.5 rounded-lg transition-all border active:scale-95 flex items-center justify-center ${
                                              isRequesting 
                                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                                : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50 border-transparent hover:border-slate-200'
                                            }`}
                                            title="Add to Requisitions"
                                          >
                                              {isRequesting ? <Check size={16} strokeWidth={3}/> : <ClipboardPlus size={16} strokeWidth={2.2}/>}
                                          </button>
                                      )}
                                      <Link 
                                        to={`/item/${encodeURIComponent(item.partNumber)}`} 
                                        className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 flex items-center justify-center"
                                        title="View Details"
                                      >
                                          <Eye size={16} strokeWidth={2}/>
                                      </Link>
                                  </div>
                              </td>
                          )}
                      </tr>
                    );
                })}
            </tbody>
        </table>
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-[#FAFBFD]/30">
           <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Page {fd(currentPage)} Ledger</span>
           <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-all shadow-sm"><ChevronLeft size={14}/></button>
              <button onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition-all shadow-sm"><ChevronRight size={14}/></button>
           </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-4 space-y-4">
         {isOwner && !disableSelection && !isEditMode && currentItems.length > 0 && (
           <div className="flex flex-col gap-2 mb-2">
              <div className="px-2 py-1 flex items-center justify-between bg-slate-100 rounded-xl border border-slate-200">
                 <div className="flex items-center gap-3">
                     <button 
                       onClick={toggleSelectPage}
                       className={`p-2.5 rounded-lg transition-all ${isAllOnPageSelected ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
                     >
                       {isAllOnPageSelected ? <CheckSquare size={20} strokeWidth={3}/> : <Square size={20} strokeWidth={2}/>}
                     </button>
                     <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Select Page</span>
                 </div>
                 {selectedParts.size > 0 && (
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 uppercase tracking-widest">{fd(selectedParts.size)}</span>
                     <button onClick={handleBulkArchive} className="p-2.5 text-amber-600 bg-white rounded-lg shadow-soft border border-slate-200 active:scale-90">
                       {showArchived ? <ArchiveRestore size={18}/> : <Archive size={18}/>}
                     </button>
                   </div>
                 )}
              </div>
              {isAllOnPageSelected && !isTrulyAllSelected && filteredItems.length > currentItems.length && (
                 <button 
                   onClick={selectTrulyAll}
                   className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest animate-fade-in shadow-md"
                 >
                   Select all {filteredItems.length} parts in filtered set
                 </button>
              )}
           </div>
         )}
         {currentItems.map(item => <SwipeableMobileItem key={item.id} item={item} userRole={userRole} toggleSelect={toggleSelect} isSelected={!disableSelection && !isEditMode && selectedParts.has(item.partNumber)} enableSelection={enableActions && !disableSelection} onQuickRequest={handleQuickRequest} isEditMode={isEditMode} onDirectUpdate={handleDirectUpdate} />)}
      </div>
    </div>
  );
};

export default StockTable;
