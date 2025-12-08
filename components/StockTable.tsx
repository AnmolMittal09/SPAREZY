import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand, Role } from '../types';
import { toggleArchiveStatus, bulkArchiveItems } from '../services/inventoryService';
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Archive, ArchiveRestore, MoreHorizontal, Filter } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand;
  userRole?: Role;
  enableActions?: boolean;
}

const StockTable: React.FC<StockTableProps> = ({ items, title, brandFilter, userRole, enableActions = true }) => {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 50;
  
  // Selection
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());

  // Permission
  const isOwner = userRole === Role.OWNER;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedParts(new Set());
  }, [search, brandFilter, showArchived]);

  const toggleSelect = (partNumber: string) => {
      const newSet = new Set(selectedParts);
      if (newSet.has(partNumber)) newSet.delete(partNumber);
      else newSet.add(partNumber);
      setSelectedParts(newSet);
  };

  const toggleSelectAll = () => {
      const ids = currentItems.map(i => i.partNumber);
      if (ids.every(id => selectedParts.has(id))) {
          const newSet = new Set(selectedParts);
          ids.forEach(id => newSet.delete(id));
          setSelectedParts(newSet);
      } else {
          const newSet = new Set(selectedParts);
          ids.forEach(id => newSet.add(id));
          setSelectedParts(newSet);
      }
  };

  const handleBulkArchive = async () => {
      if (!confirm(`Archive ${selectedParts.size} items?`)) return;
      await bulkArchiveItems(Array.from(selectedParts), true);
      setSelectedParts(new Set());
      window.location.reload(); // Simple reload to refresh data for now
  };

  // Filter & Sort
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
        if (!showArchived && item.isArchived) return false;
        if (showArchived && !item.isArchived) return false;
        if (brandFilter && item.brand !== brandFilter) return false;
        
        if (search) {
            const lower = search.toLowerCase();
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
  }, [items, search, brandFilter, showArchived, sortConfig]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    <div className="bg-white rounded-lg shadow border border-slate-200 flex flex-col h-full">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
             <h2 className="font-bold text-slate-800">{title || 'Parts List'}</h2>
             <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">{filteredItems.length} items</span>
        </div>
        
        <div className="flex items-center gap-3">
            {selectedParts.size > 0 && isOwner && (
                <button onClick={handleBulkArchive} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                    Archive {selectedParts.size} Selected
                </button>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter table..." 
                  className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
            </div>

            {isOwner && (
                 <button 
                    onClick={() => setShowArchived(!showArchived)}
                    className={`p-2 rounded-md border ${showArchived ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    title="Toggle Archives"
                 >
                    {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                 </button>
            )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                    {enableActions && isOwner && (
                        <th className="px-4 py-3 border-b border-slate-200 w-10">
                            <input type="checkbox" onChange={toggleSelectAll} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                        </th>
                    )}
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 cursor-pointer select-none group" onClick={() => requestSort('partNumber')}>
                        <div className="flex items-center gap-1">Part Number <SortIcon col="partNumber"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 cursor-pointer select-none" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Description <SortIcon col="name"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-center w-24">Brand</th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 w-24">Rack Loc</th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-center cursor-pointer select-none w-24" onClick={() => requestSort('quantity')}>
                         <div className="flex items-center justify-center gap-1">Stock <SortIcon col="quantity"/></div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-600 text-right cursor-pointer select-none w-32" onClick={() => requestSort('price')}>
                         <div className="flex items-center justify-end gap-1">Selling Price <SortIcon col="price"/></div>
                    </th>
                    {enableActions && <th className="px-4 py-3 border-b border-slate-200 w-16"></th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {currentItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500">No parts found.</td></tr>
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
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" 
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
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.brand === Brand.HYUNDAI ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                        {item.brand.substring(0, 3)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                    {/* Mock Rack Location */}
                                    {item.brand === 'HYUNDAI' ? 'H-' : 'M-'}{item.partNumber.substring(0,1)}-{Math.floor(Math.random() * 10)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`font-bold ${isZero ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-slate-700'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">₹{item.price.toLocaleString()}</td>
                                {enableActions && (
                                    <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="text-slate-400 hover:text-primary-600">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white rounded-b-lg">
          <div className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50">
                  <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-50">
                  <ChevronRight size={16} />
              </button>
          </div>
      </div>
    </div>
  );
};

export default StockTable;