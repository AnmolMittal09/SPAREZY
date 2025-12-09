
import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand, Role } from '../types';
import { bulkArchiveItems } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, Loader2, Edit, Eye, Trash2, CheckSquare } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand; // If provided, strictly filters by this brand
  userRole?: Role;
  enableActions?: boolean;
  
  // New Props for Dashboard Control
  externalSearch?: string;
  hideToolbar?: boolean;
  stockStatusFilter?: 'ALL' | 'LOW' | 'OUT';
}

const StockTable: React.FC<StockTableProps> = ({ 
    items, 
    title, 
    brandFilter, 
    userRole, 
    enableActions = true,
    externalSearch,
    hideToolbar = false,
    stockStatusFilter = 'ALL'
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 50;
  
  // Selection
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);

  // Permission
  const isOwner = userRole === Role.OWNER;
  
  // Use external search if provided, otherwise internal
  const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;

  useEffect(() => {
    setCurrentPage(1);
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

  // Filter & Sort
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
        // Archive Logic
        if (!showArchived && item.isArchived) return false;
        if (showArchived && !item.isArchived) return false;
        
        // Brand Logic
        if (brandFilter && item.brand !== brandFilter) return false;
        
        // Status Logic (New)
        if (stockStatusFilter === 'LOW' && (item.quantity === 0 || item.quantity >= item.minStockThreshold)) return false;
        if (stockStatusFilter === 'OUT' && item.quantity > 0) return false;

        // Search Logic
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
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return result;
  }, [items, effectiveSearch, brandFilter, showArchived, sortConfig, stockStatusFilter]);

  // Mobile "Load More" Logic (Instead of pagination numbers on mobile)
  const [mobileLimit, setMobileLimit] = useState(20);
  const mobileItems = filteredItems.slice(0, mobileLimit);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Selection Logic
  const isAllPageSelected = currentItems.length > 0 && currentItems.every(i => selectedParts.has(i.partNumber));
  const areAllSelected = filteredItems.length > 0 && selectedParts.size === filteredItems.length;

  const toggleSelectAllPage = () => {
    const newSet = new Set(selectedParts);
    if (isAllPageSelected) {
        currentItems.forEach(i => newSet.delete(i.partNumber));
    } else {
        currentItems.forEach(i => newSet.add(i.partNumber));
    }
    setSelectedParts(newSet);
  };

  const selectAllGlobal = () => {
    const allIds = filteredItems.map(i => i.partNumber);
    setSelectedParts(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedParts(new Set());
  };

  const requestSort = (key: keyof StockItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ col }: { col: keyof StockItem }) => {
      if (sortConfig?.key !== col) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary-600" /> : <ArrowDown size={12} className="text-primary-600" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Table Toolbar (Conditionally Rendered) */}
      {!hideToolbar && (
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 justify-between md:justify-start">
                <div className="flex items-center gap-3">
                   <h2 className="font-bold text-slate-800 text-lg md:text-base">{title || 'Parts List'}</h2>
                   <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">{filteredItems.length}</span>
                </div>
                {/* Mobile Archived Toggle */}
                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`md:hidden p-2 rounded-md border ${showArchived ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500'}`}
                    >
                        {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                )}
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                {selectedParts.size > 0 && isOwner && (
                    <button 
                    onClick={handleBulkArchive} 
                    disabled={isArchiving}
                    className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isArchiving ? <Loader2 className="animate-spin" size={14} /> : null}
                        Archive ({selectedParts.size})
                    </button>
                )}

                <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                    type="text" 
                    placeholder="Filter table..." 
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-64"
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    />
                </div>

                {isOwner && (
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`hidden md:block p-2 rounded-md border ${showArchived ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        title="Toggle Archives"
                    >
                        {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                )}
            </div>
        </div>
      )}

      {/* Bulk Selection Banner */}
      {enableActions && isOwner && (
        <>
          {isAllPageSelected && !areAllSelected && (
            <div className="bg-blue-50 border-b border-blue-100 p-2 text-center text-sm text-blue-800 animate-fade-in">
               All <b>{currentItems.length}</b> on page selected. 
               <button onClick={selectAllGlobal} className="ml-2 font-bold underline hover:text-blue-900">
                 Select all {filteredItems.length}
               </button>
            </div>
          )}
          {areAllSelected && (
            <div className="bg-blue-50 border-b border-blue-100 p-2 text-center text-sm text-blue-800 animate-fade-in">
               All <b>{filteredItems.length}</b> selected.
               <button onClick={clearSelection} className="ml-2 font-bold underline hover:text-blue-900">
                 Clear
               </button>
            </div>
          )}
        </>
      )}

      {/* --- DESKTOP TABLE VIEW (Visible on md and up) --- */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                    {enableActions && isOwner && (
                        <th className="px-4 py-3 border-b border-slate-200 w-10">
                            <input 
                              type="checkbox" 
                              checked={isAllPageSelected}
                              onChange={toggleSelectAllPage} 
                              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                        </th>
                    )}
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 cursor-pointer select-none group" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-1">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 cursor-pointer select-none" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-center w-24">Brand</th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-center cursor-pointer select-none w-24" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-1">Stock <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-right cursor-pointer select-none w-32" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-1">Price <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-4 py-3 border-b border-slate-200 w-16">Action</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No parts found matching filters.</td></tr>
                ) : (
                    currentItems.map((item, idx) => {
                        const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                        const isZero = item.quantity === 0;
                        const isSelected = selectedParts.has(item.partNumber);

                        return (
                            <tr key={item.id} className={`group hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${isLow ? 'bg-yellow-50/50' : ''} ${isZero ? 'bg-red-50/50' : ''}`}>
                                {enableActions && isOwner && (
                                    <td className="px-4 py-3">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleSelect(item.partNumber)}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-3 font-mono font-medium text-slate-700">
                                    <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="hover:text-primary-600 hover:underline">
                                        {item.partNumber}
                                    </Link>
                                    {isZero && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">OUT</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-medium">{item.name}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.brand === Brand.HYUNDAI ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                        {item.brand.substring(0, 3)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`font-bold ${isZero ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-slate-700'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">₹{item.price.toLocaleString()}</td>
                                {enableActions && (
                                    <td className="px-4 py-3 text-center">
                                         <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-primary-600 hover:text-primary-800 p-1.5 hover:bg-primary-50 rounded-lg inline-block">
                                            <Eye size={16} />
                                         </Link>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
        
        {/* Desktop Pagination */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white sticky bottom-0 z-10">
          <div className="text-xs text-slate-500">
              Page {currentPage} / {totalPages}
          </div>
          <div className="flex gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                  <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                  <ChevronRight size={16} />
              </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE DENSE LIST VIEW (Visible below md) --- */}
      <div className="md:hidden flex-1 overflow-y-auto bg-slate-50 p-2 space-y-2">
         {mobileItems.length === 0 ? (
             <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">No parts found matching filters.</div>
         ) : (
             mobileItems.map((item) => {
                const isLow = item.quantity > 0 && item.quantity <= item.minStockThreshold;
                const isZero = item.quantity === 0;

                return (
                   <Link 
                      key={item.id}
                      to={`/item/${encodeURIComponent(item.partNumber)}`}
                      className="block bg-white border border-slate-100 p-3 rounded-lg shadow-sm active:bg-slate-50"
                   >
                      <div className="flex justify-between items-start">
                         <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                               <span className="font-bold text-slate-900 text-base">{item.partNumber}</span>
                               <span className={`text-[10px] px-1 rounded font-bold uppercase ${item.brand === Brand.HYUNDAI ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                                  {item.brand.substring(0, 3)}
                               </span>
                            </div>
                            <span className="text-xs text-slate-500 line-clamp-1">{item.name}</span>
                         </div>
                         
                         <div className="text-right">
                            <div className="font-bold text-slate-900">₹{item.price}</div>
                            <div className={`text-xs font-medium px-1.5 py-0.5 rounded mt-1 inline-block ${isZero ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                               {item.quantity} In Stock
                            </div>
                         </div>
                      </div>
                   </Link>
                );
             })
         )}
         
         {/* Load More Button for Mobile */}
         {mobileLimit < filteredItems.length && (
            <button 
              onClick={() => setMobileLimit(prev => prev + 20)}
              className="w-full py-3 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm"
            >
               Load More ({filteredItems.length - mobileLimit} remaining)
            </button>
         )}

         {/* Bottom Spacer for FAB and Navigation */}
         <div className="h-24"></div>
      </div>
    </div>
  );
};

export default StockTable;
