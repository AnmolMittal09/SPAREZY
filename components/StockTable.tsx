import React, { useState, useMemo } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role } from '../types';
import { bulkArchiveItems } from '../services/inventoryService';
import { 
  Search, ChevronLeft, ChevronRight, Archive, 
  ArchiveRestore, Loader2, Eye, CheckSquare, 
  Square, MinusSquare, History, ArrowUpDown 
} from 'lucide-react';

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

const MobileRow: React.FC<{ item: StockItem; userRole?: Role; isSelected: boolean; onToggle: () => void }> = ({ item, userRole, isSelected, onToggle }) => {
  const navigate = useNavigate();
  const isZero = item.quantity === 0;
  const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;

  return (
    <div 
      onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
      className={`relative bg-white border-b border-slate-200 p-4 flex items-center gap-4 transition-colors active:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}
    >
        {userRole === Role.OWNER && (
          <div onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex-none p-1">
            {isSelected ? <CheckSquare size={20} className="text-brand-600" /> : <Square size={20} className="text-slate-300" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white uppercase ${item.brand === Brand.HYUNDAI ? 'bg-hyundai' : 'bg-mahindra'}`}>
                    {item.brand.substring(0,3)}
                </span>
                <span className="font-bold text-slate-900 text-base truncate uppercase">{item.partNumber}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate">{item.name}</p>
        </div>
        <div className="flex-none text-right">
            <div className={`text-lg font-black leading-none ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                {item.quantity}
                <span className="text-[10px] text-slate-400 ml-1 font-bold">PCS</span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1">₹{item.price.toLocaleString()}</p>
        </div>
    </div>
  );
};

const StockTable: React.FC<StockTableProps> = ({ 
    items, title, brandFilter, userRole, enableActions = true, 
    externalSearch, hideToolbar = false, stockStatusFilter = 'ALL'
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  
  const isOwner = userRole === Role.OWNER;
  const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;
  const itemsPerPage = 50;

  const filteredItems = useMemo(() => {
    return items.filter(item => {
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
  }, [items, effectiveSearch, brandFilter, showArchived, stockStatusFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleBulkArchive = async () => {
      if (!confirm(`Archive ${selectedParts.size} items?`)) return;
      setIsArchiving(true);
      try {
        await bulkArchiveItems(Array.from(selectedParts), true);
        setSelectedParts(new Set());
        window.location.reload(); 
      } catch (e) { alert("Error archiving items."); } finally { setIsArchiving(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-interface border border-slate-200 flex flex-col overflow-hidden">
      {!hideToolbar && (
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-3">
               <h2 className="font-bold text-slate-900 text-lg">{title || 'Parts Registry'}</h2>
               <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded">{filteredItems.length} SKUs</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" placeholder="Search..." 
                      className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 w-full md:w-64"
                      value={internalSearch} onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>
                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`p-2 rounded-lg border transition-all ${showArchived ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                        {showArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                    {isOwner && <th className="px-4 py-3 w-10"></th>}
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Part Number</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest">Description</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest text-center">Brand</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest text-right">Stock</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-[10px] tracking-widest text-right">Price</th>
                    <th className="px-4 py-3 w-12"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {currentItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 group">
                        {isOwner && (
                            <td className="px-4 py-3">
                                <input 
                                  type="checkbox" 
                                  checked={selectedParts.has(item.partNumber)} 
                                  onChange={() => {
                                      const n = new Set(selectedParts);
                                      if (n.has(item.partNumber)) n.delete(item.partNumber); else n.add(item.partNumber);
                                      setSelectedParts(n);
                                  }}
                                  className="w-4 h-4 rounded text-brand-600"
                                />
                            </td>
                        )}
                        <td className="px-4 py-3 font-bold text-slate-900 uppercase">
                          <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="hover:text-brand-600 transition-colors">{item.partNumber}</Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${item.brand === Brand.HYUNDAI ? 'bg-hyundai' : 'bg-mahindra'}`}>
                                {item.brand.substring(0,3)}
                            </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${item.quantity === 0 ? 'text-rose-600' : 'text-slate-900'}`}>{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-bold">₹{item.price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                            <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-300 hover:text-brand-600"><Eye size={18} /></Link>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MOBILE LIST */}
      <div className="md:hidden flex flex-col">
        {currentItems.map(item => (
            <MobileRow 
              key={item.id} item={item} userRole={userRole} 
              isSelected={selectedParts.has(item.partNumber)} 
              onToggle={() => {
                const n = new Set(selectedParts);
                if (n.has(item.partNumber)) n.delete(item.partNumber); else n.add(item.partNumber);
                setSelectedParts(n);
              }}
            />
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/30">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 rounded border bg-white disabled:opacity-30"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-2 rounded border bg-white disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
        </div>
      )}

      {/* BULK ACTIONS FLOAT */}
      {selectedParts.size > 0 && isOwner && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-fade-in ring-4 ring-slate-900/10">
              <span className="text-sm font-bold">{selectedParts.size} Items Selected</span>
              <div className="h-4 w-px bg-white/20"></div>
              <button 
                onClick={handleBulkArchive} disabled={isArchiving}
                className="flex items-center gap-2 text-xs font-black uppercase text-rose-400 hover:text-rose-300 transition-colors"
              >
                {isArchiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archive
              </button>
              <button onClick={() => setSelectedParts(new Set())} className="text-xs font-bold text-slate-400 hover:text-white">Deselect</button>
          </div>
      )}
    </div>
  );
};

export default StockTable;