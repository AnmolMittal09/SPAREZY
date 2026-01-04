
import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role, PriceHistoryEntry } from '../types';
import { bulkArchiveItems, fetchPriceHistory } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, Loader2, Eye, Clock, ArrowRight, CheckSquare, Square, MinusSquare, History, Calendar } from 'lucide-react';

// Added StockTableProps interface definition
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
  
  const isOwner = userRole === Role.OWNER;
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768;

  const loadHistory = async () => {
    if (history.length > 0 || loadingHistory) return;
    setLoadingHistory(true);
    try { const data = await fetchPriceHistory(partNumber); setHistory(data || []); }
    catch (err) { console.error(err); } finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShowHistory(false); };
    if (showHistory && !isMobile) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory, isMobile]);

  return (
    <div className={`relative flex ${align === 'right' ? 'justify-end' : 'justify-start'} items-center`}>
      <div 
        onClick={(e) => { e.stopPropagation(); if (!visible) setVisible(true); else if (isOwner && !isMobile) { loadHistory(); setShowHistory(!showHistory); } }}
        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all cursor-pointer ${visible ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}
      >
        {!visible ? <><span className="text-sm font-medium blur-[4px] select-none">₹88,888</span><Eye size={12}/></> : <span className="text-sm font-bold">₹{price.toLocaleString()}</span>}
        {visible && isOwner && !isMobile && <History size={12} className="text-slate-400" />}
      </div>
      {showHistory && isOwner && !isMobile && (
        <div ref={popoverRef} className="absolute bottom-full right-0 mb-2 z-[600] w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-fade-in">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b pb-2">Price Ledger</p>
          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
            {loadingHistory ? <Loader2 size={16} className="animate-spin mx-auto my-4 text-slate-300" /> : history.length > 0 ? history.map(h => (
              <div key={h.id} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">{new Date(h.changeDate).toLocaleDateString()}</span>
                <span className="font-bold">₹{h.newPrice.toLocaleString()}</span>
              </div>
            )) : <p className="text-center py-4 text-slate-400 text-[11px]">No history found</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const StockTable: React.FC<StockTableProps> = ({ items, title, brandFilter, userRole, enableActions = true, externalSearch, hideToolbar = false, stockStatusFilter = 'ALL' }) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const navigate = useNavigate();
  const isOwner = userRole === Role.OWNER;
  const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;
  const itemsPerPage = 50;

  const filteredItems = useMemo(() => {
    let result = items.filter(i => {
        if (!showArchived && i.isArchived) return false;
        if (showArchived && !i.isArchived) return false;
        if (brandFilter && i.brand !== brandFilter) return false;
        if (stockStatusFilter === 'LOW' && (i.quantity === 0 || i.quantity >= i.minStockThreshold)) return false;
        if (stockStatusFilter === 'OUT' && i.quantity > 0) return false;
        if (effectiveSearch) {
            const l = effectiveSearch.toLowerCase();
            return i.partNumber.toLowerCase().includes(l) || i.name.toLowerCase().includes(l);
        }
        return true;
    });
    if (sortConfig) {
        result.sort((a, b) => {
            const av = a[sortConfig.key] ?? 0; const bv = b[sortConfig.key] ?? 0;
            return sortConfig.direction === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
        });
    }
    return result;
  }, [items, effectiveSearch, brandFilter, showArchived, sortConfig, stockStatusFilter]);

  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const toggleSelect = (pn: string) => {
    const s = new Set(selectedParts);
    if (s.has(pn)) s.delete(pn); else s.add(pn);
    setSelectedParts(s);
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${selectedParts.size} items?`)) return;
    setIsArchiving(true);
    try { await bulkArchiveItems(Array.from(selectedParts), true); setSelectedParts(new Set()); window.location.reload(); }
    catch (e) { alert("Failed to archive."); } finally { setIsArchiving(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-3d border border-slate-200 overflow-hidden flex flex-col">
      {!hideToolbar && (
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
             <h2 className="font-bold text-slate-900">{title || 'Registry'}</h2>
             <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{filteredItems.length} SKUs</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedParts.size > 0 && isOwner && (
                <button onClick={handleBulkArchive} disabled={isArchiving} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100 hover:bg-rose-100">
                    {isArchiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} {selectedParts.size} Archive
                </button>
            )}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 w-48 md:w-64 transition-all" value={internalSearch} onChange={e => setInternalSearch(e.target.value)} />
            </div>
            {isOwner && (
                <button onClick={() => setShowArchived(!showArchived)} className={`p-1.5 rounded-lg border transition-all ${showArchived ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                    {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </button>
            )}
          </div>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                    {isOwner && <th className="px-4 py-3 w-10"></th>}
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider cursor-pointer" onClick={() => setSortConfig({key:'partNumber', direction: sortConfig?.direction==='asc'?'desc':'asc'})}>Part Number</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Description</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center w-24">Brand</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center w-24" onClick={() => setSortConfig({key:'quantity', direction: sortConfig?.direction==='asc'?'desc':'asc'})}>Stock</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right w-32">Price</th>
                    <th className="px-4 py-3 w-12"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {currentItems.map(item => (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${selectedParts.has(item.partNumber) ? 'bg-brand-50/50' : ''}`}>
                        {isOwner && (
                            <td className="px-4 py-3">
                                <input type="checkbox" checked={selectedParts.has(item.partNumber)} onChange={() => toggleSelect(item.partNumber)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500" />
                            </td>
                        )}
                        <td className="px-4 py-3 font-bold text-slate-900 uppercase">{item.partNumber}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{item.name}</td>
                        <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-800' : 'bg-red-700'}`}>{item.brand.substring(0,3)}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                        <td className="px-4 py-3 text-right"><PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} /></td>
                        <td className="px-4 py-3 text-center">
                            <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-300 hover:text-brand-600"><Eye size={16} /></Link>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-slate-100">
        {currentItems.map(item => (
            <div key={item.id} onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)} className={`p-4 bg-white flex flex-col gap-2 active:bg-slate-50 ${selectedParts.has(item.partNumber) ? 'bg-brand-50' : ''}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {isOwner && <div onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }} className="p-1">{selectedParts.has(item.partNumber) ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} className="text-slate-300" />}</div>}
                        <span className="font-bold text-slate-900 uppercase text-base">{item.partNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-800' : 'bg-red-700'}`}>{item.brand.substring(0,3)}</span>
                    </div>
                    <div className="text-right">
                        <span className={`text-lg font-bold ${item.quantity <= item.minStockThreshold ? 'text-amber-600' : 'text-slate-900'}`}>{item.quantity}</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">PCS</span>
                    </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium truncate max-w-[60%]">{item.name}</span>
                    <PriceCell price={item.price} partNumber={item.partNumber} userRole={userRole} align="right" />
                </div>
            </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border bg-white disabled:opacity-30"><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border bg-white disabled:opacity-30"><ChevronRight size={16}/></button>
          </div>
        </div>
      )}
    </div>
  );
};
export default StockTable;
