import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import { StockItem, Brand, Role } from '../types';
import { bulkArchiveItems } from '../services/inventoryService';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Archive, 
  ArchiveRestore, 
  Eye, 
  Loader2, 
  Plus,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
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

const MobileItem: React.FC<{ item: StockItem; userRole?: Role; isSelected: boolean; toggleSelect: (pn: string) => void }> = ({ item, userRole, isSelected, toggleSelect }) => {
  const navigate = useNavigate();
  const isZero = item.quantity === 0;
  const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;

  return (
    <div 
      onClick={() => navigate(`/item/${encodeURIComponent(item.partNumber)}`)}
      className={`relative bg-white border-b border-slate-100 py-3.5 px-4 flex items-center gap-4 active:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
    >
        {userRole === Role.OWNER && (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSelect(item.partNumber); }}
            className="flex-none"
          >
            <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300'}`}>
                {isSelected && <CheckCircle2 size={12} strokeWidth={3} />}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white uppercase ${item.brand === Brand.HYUNDAI ? 'bg-hyundai' : 'bg-mahindra'}`}>
                    {item.brand.substring(0,3)}
                </span>
                <span className="font-bold text-slate-900 text-[15px] truncate uppercase">{item.partNumber}</span>
            </div>
            <p className="text-[12px] text-slate-500 font-medium truncate">{item.name}</p>
        </div>

        <div className="flex-none text-right">
            <div className={`text-lg font-bold leading-none ${isZero ? 'text-rose-600' : isLow ? 'text-amber-500' : 'text-slate-900'}`}>
                {item.quantity}
                <span className="text-[9px] text-slate-400 ml-1 uppercase">Pcs</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">₹{item.price.toLocaleString()}</p>
        </div>

        <div className="flex-none text-slate-300">
            <ChevronRight size={18} />
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
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);

  const isOwner = userRole === Role.OWNER;
  const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;

  const filteredItems = useMemo(() => {
    return items.filter(item => {
        if (!showArchived && item.isArchived) return false;
        if (showArchived && !item.isArchived) return false;
        if (brandFilter && item.brand !== brandFilter) return false;
        if (stockStatusFilter === 'LOW' && (item.quantity === 0 || item.quantity >= item.minStockThreshold)) return false;
        if (stockStatusFilter === 'OUT' && item.quantity > 0) return false;
        if (effectiveSearch) {
            const lower = effectiveSearch.toLowerCase();
            return (
                item.partNumber.toLowerCase().includes(lower) ||
                item.name.toLowerCase().includes(lower)
            );
        }
        return true;
    });
  }, [items, effectiveSearch, brandFilter, showArchived, stockStatusFilter]);

  const toggleSelect = (pn: string) => {
    const newSet = new Set(selectedParts);
    if (newSet.has(pn)) newSet.delete(pn);
    else newSet.add(pn);
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
      alert("Error archiving items.");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {!hideToolbar && (
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <h2 className="font-bold text-slate-900">{title || 'Registry'}</h2>
               <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{filteredItems.length} SKUs</span>
            </div>
            
            <div className="flex items-center gap-2">
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

      {/* SEARCH OVERLAY (MOBILE ONLY IF HIDE TOOLBAR) */}
      {!externalSearch && !hideToolbar && (
        <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search SKU..." 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                />
            </div>
        </div>
      )}

      {/* MOBILE LIST */}
      <div className="flex flex-col">
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center">
            <Search size={48} className="mx-auto text-slate-200 mb-4 opacity-50" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Parts Found</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <MobileItem 
              key={item.id} 
              item={item} 
              userRole={userRole} 
              isSelected={selectedParts.has(item.partNumber)}
              toggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

      {/* FIXED BULK ACTION BAR - High Contrast Ergonomic */}
      {selectedParts.size > 0 && isOwner && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-[90] safe-bottom flex gap-3 animate-slide-in shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
           <button 
              onClick={() => setSelectedParts(new Set())}
              className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl active:scale-95 transition-all"
           >
              Cancel
           </button>
           <button 
              onClick={handleBulkArchive}
              disabled={isArchiving}
              className="flex-[2] py-3 text-sm font-bold text-white bg-rose-600 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
           >
              {isArchiving ? <Loader2 className="animate-spin" size={18} /> : <Archive size={18} />}
              Archive ({selectedParts.size})
           </button>
        </div>
      )}
    </div>
  );
};

export default StockTable;