
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry, RequestStatus } from '../types';
import { bulkArchiveItems, fetchPriceHistory } from '../services/inventoryService';
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
  Check
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
        className={`group/price flex items-center gap-2 p-1.5 rounded-lg border-2 transition-all cursor-pointer ${
          visible ? 'bg-slate-950 text-white border-slate-900 shadow-md' : 'bg-white text-slate-300 border-slate-200 hover:border-slate-400'
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
        <div ref={popoverRef} className="absolute bottom-full mb-3 right-0 z-[600] w-64 bg-white rounded-2xl shadow-elevated border-2 border-slate-200 p-5 animate-slide-up">
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

const SwipeableMobileItem: React.FC<any> = React.memo(({ item, userRole, toggleSelect, isSelected, enableSelection, onQuickRequest }) => {
    const navigate = useNavigate();
    const isZero = item.quantity === 0;
    const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;

    return (
        <div 
            onClick={() => { if(enableSelection && userRole === Role.OWNER) toggleSelect(item.partNumber); }}
            className={`relative bg-white border-2 p-5 rounded-2xl shadow-soft transition-all duration-200 flex flex-col gap-4 ${isSelected ? 'border-blue-600 ring-4 ring-blue-50 bg-blue-50/20' : 'border-slate-200'} ${isZero ? 'bg-slate-50/50' : ''}`}
        >
            <div className="flex gap-4 items-start">
                {enableSelection && userRole === Role.OWNER && (
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
                            <span className={`text-xl font-black tabular-nums ${isZero ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-slate-950'}`}>
                                {formatQty(item.quantity)} <span className="text-[10px] uppercase font-extrabold text-slate-500 ml-0.5">PCS</span>
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 font-bold uppercase tracking-tight leading-snug line-clamp-1">{item.name}</p>
                </div>
            </div>
            <div className="pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="left" />
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/item/${encodeURIComponent(item.partNumber)}`); }} className="p-2.5 bg-slate-100 text-slate-900 rounded-xl active:scale-90 border border-slate-200"><Eye size={18} strokeWidth={2.5}/></button>
                    <button onClick={(e) => { e.stopPropagation(); onQuickRequest(item.partNumber); }} className="p-2.5 bg-blue-700 text-white rounded-xl active:scale-90 shadow-lg"><ClipboardPlus size={18} strokeWidth={2.5}/></button>
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
  const isOwner = userRole === Role.OWNER;
  const effectiveSearch = externalSearch !== undefined ? (externalSearch || internalSearch) : internalSearch;

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
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
  }, [items, effectiveSearch, showArchived, sortConfig, stockStatusFilter, brandFilter]);

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
        // Show success briefly
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

  const toggleSelect = useCallback((pn: string) => {
    if (disableSelection) return;
    setSelectedParts(prev => { const n = new Set(prev); if (n.has(pn)) n.delete(pn); else n.add(pn); return n; });
  }, [disableSelection]);

  const isAllOnPageSelected = useMemo(() => {
    if (disableSelection) return false;
    return currentItems.length > 0 && currentItems.every(i => selectedParts.has(i.partNumber));
  }, [currentItems, selectedParts, disableSelection]);

  const isTrulyAllSelected = useMemo(() => {
    if (disableSelection) return false;
    return filteredItems.length > 0 && filteredItems.length === selectedParts.size;
  }, [filteredItems, selectedParts, disableSelection]);

  const toggleSelectPage = () => {
    if (disableSelection) return;
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
    if (disableSelection) return;
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
    <div className="bg-white rounded-3xl shadow-premium border-2 border-slate-200 flex flex-col overflow-visible">
      {!hideToolbar && (
        <div className="px-8 py-6 border-b-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
            <div className="flex items-center gap-4">
               <h2 className="font-extrabold text-slate-950 text-xl tracking-tight uppercase">{title || 'Registry Control'}</h2>
               <span className="bg-slate-950 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{formatQty(filteredItems.length)} items</span>
            </div>
            <div className="flex items-center gap-3">
                {selectedParts.size > 0 && isOwner && !disableSelection && (
                    <button 
                      onClick={handleBulkArchive}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-200 transition-all active:scale-95"
                    >
                      {showArchived ? <ArchiveRestore size={16}/> : <Archive size={16}/>}
                      {showArchived ? 'Restore' : 'Archive'} ({fd(selectedParts.size)})
                    </button>
                )}
                <button onClick={handleExport} className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 transition-all shadow-soft"><Download size={22} strokeWidth={2.5}/></button>
                <div className="relative group hidden md:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} strokeWidth={3} />
                    <input type="text" placeholder="Direct SKU Filter..." className="pl-12 pr-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold w-72 focus:border-slate-900 outline-none transition-all shadow-inner-soft" value={internalSearch} onChange={e => setInternalSearch(e.target.value)}/>
                </div>
                {isOwner && (
                    <button onClick={() => setShowArchived(!showArchived)} className={`hidden md:flex p-3 rounded-2xl border-2 transition-all ${showArchived ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-slate-200 text-slate-500'}`}>
                        {showArchived ? <ArchiveRestore size={22} /> : <Archive size={22} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {/* Bulk Select Feedback Banner */}
      {isOwner && !disableSelection && isAllOnPageSelected && !isTrulyAllSelected && filteredItems.length > currentItems.length && (
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
                    {enableActions && isOwner && !disableSelection && (
                        <th className="px-8 py-5 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={isAllOnPageSelected} 
                              onChange={toggleSelectPage} 
                              className="w-5 h-5 rounded border-2 border-slate-400 text-blue-700 focus:ring-slate-950 transition-all cursor-pointer" 
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
                      <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${!disableSelection && selectedParts.has(item.partNumber) ? 'bg-blue-50/60' : ''}`}>
                          {enableActions && isOwner && !disableSelection && (
                              <td className="px-8 py-5 text-center">
                                  <input type="checkbox" checked={selectedParts.has(item.partNumber)} onChange={() => toggleSelect(item.partNumber)} className="w-5 h-5 rounded border-2 border-slate-300 text-blue-700" />
                              </td>
                          )}
                          <td className="px-8 py-5"><Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="font-black text-slate-950 hover:text-blue-700 transition-colors tracking-tight text-[16px] uppercase">{item.partNumber}</Link></td>
                          <td className="px-8 py-5 text-slate-800 font-bold uppercase tracking-tight text-sm truncate max-w-xs">{item.name}</td>
                          <td className="px-8 py-5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-700' : 'bg-red-700'}`}>{item.brand.slice(0,3)}</span></td>
                          <td className="px-8 py-5 text-center"><span className={`font-black text-[17px] tabular-nums ${item.quantity === 0 ? 'text-rose-700' : item.quantity <= item.minStockThreshold ? 'text-amber-700' : 'text-slate-950'}`}>{formatQty(item.quantity)}</span></td>
                          <td className="px-8 py-5 text-right"><PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} /></td>
                          {enableActions && (
                              <td className="px-8 py-5 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button 
                                        onClick={() => handleQuickRequest(item.partNumber)} 
                                        className={`p-3 rounded-xl transition-all border-2 active:scale-95 flex items-center justify-center ${
                                          isRequesting 
                                            ? 'bg-teal-500 text-white border-teal-500' 
                                            : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-transparent hover:border-blue-100'
                                        }`}
                                        title="Add to Requisitions"
                                      >
                                          {isRequesting ? <Check size={18} strokeWidth={4}/> : <ClipboardPlus size={18} strokeWidth={2.5}/>}
                                      </button>
                                      <Link 
                                        to={`/item/${encodeURIComponent(item.partNumber)}`} 
                                        className="p-3 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-all border-2 border-transparent hover:border-slate-200 flex items-center justify-center"
                                        title="View Details"
                                      >
                                          <Eye size={18} strokeWidth={2.5}/>
                                      </Link>
                                  </div>
                              </td>
                          )}
                      </tr>
                    );
                })}
            </tbody>
        </table>
        <div className="p-6 border-t-2 border-slate-100 flex justify-between items-center bg-slate-50">
           <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-widest">Page {fd(currentPage)} Ledger</span>
           <div className="flex gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-6 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-slate-900 font-black text-xs uppercase tracking-widest hover:border-slate-900 transition-all shadow-soft"><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentPage(p => p + 1)} className="px-6 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-slate-900 font-black text-xs uppercase tracking-widest hover:border-slate-900 transition-all shadow-soft"><ChevronRight size={16}/></button>
           </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col p-4 space-y-4">
         {isOwner && !disableSelection && currentItems.length > 0 && (
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
         {currentItems.map(item => <SwipeableMobileItem key={item.id} item={item} userRole={userRole} toggleSelect={toggleSelect} isSelected={!disableSelection && selectedParts.has(item.partNumber)} enableSelection={enableActions && !disableSelection} onQuickRequest={handleQuickRequest} />)}
      </div>
    </div>
  );
};

export default StockTable;
