
import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand } from '../types';
import { Search, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Hourglass, X, Loader2, Filter, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand;
}

const StockTable: React.FC<StockTableProps> = ({ items, title, brandFilter }) => {
  // rawSearch is what the user types immediately
  const [rawSearch, setRawSearch] = useState('');
  // debouncedSearch is what triggers the expensive filter operation
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'ZERO' | 'RECENT_ZERO'>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedHSN, setSelectedHSN] = useState<string>('ALL');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 50;

  // Debounce Logic: Wait 300ms after last keystroke to update filter
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearch);
      setIsTyping(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterType, brandFilter, items, sortConfig, selectedHSN, priceRange]);

  // Derive unique HSN codes for dropdown
  const uniqueHSNs = useMemo(() => {
    const codes = new Set(items.map(i => i.hsnCode).filter(c => c && c !== 'N/A'));
    return Array.from(codes).sort();
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter(item => {
      // 1. Brand Filter
      if (brandFilter && item.brand !== brandFilter) return false;

      // 2. Search Filter (Tokenized Multi-field)
      if (debouncedSearch) {
        const searchTerms = debouncedSearch.toLowerCase().split(' ').filter(term => term.length > 0);
        const matchesAllTerms = searchTerms.every(term => 
          item.partNumber.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term) ||
          item.hsnCode.toLowerCase().includes(term)
        );
        if (!matchesAllTerms) return false;
      }

      // 3. Status Filter
      if (filterType === 'LOW') {
          if (!(item.quantity > 0 && item.quantity < item.minStockThreshold)) return false;
      }
      if (filterType === 'ZERO') {
          if (item.quantity !== 0) return false;
      }
      if (filterType === 'RECENT_ZERO') {
        if (item.quantity !== 0) return false;
        const lastUpdated = new Date(item.lastUpdated);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (lastUpdated < sevenDaysAgo) return false;
      }

      // 4. Advanced Filters
      if (selectedHSN !== 'ALL' && item.hsnCode !== selectedHSN) return false;

      if (priceRange.min !== '') {
         if (item.price < parseFloat(priceRange.min)) return false;
      }
      if (priceRange.max !== '') {
         if (item.price > parseFloat(priceRange.max)) return false;
      }

      return true;
    });

    // Sorting Logic
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [items, debouncedSearch, filterType, brandFilter, sortConfig, selectedHSN, priceRange]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const currentItems = filteredAndSortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const requestSort = (key: keyof StockItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const clearSearch = () => {
    setRawSearch('');
    setDebouncedSearch('');
  };

  const clearAllFilters = () => {
    setFilterType('ALL');
    setRawSearch('');
    setDebouncedSearch('');
    setSelectedHSN('ALL');
    setPriceRange({ min: '', max: '' });
  };

  const SortHeader = ({ label, columnKey }: { label: string, columnKey: keyof StockItem }) => {
     const isActive = sortConfig?.key === columnKey;
     return (
        <th 
          className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors group select-none"
          onClick={() => requestSort(columnKey)}
        >
          <div className={`flex items-center gap-2 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
             {label}
             <span className="flex flex-col">
                {isActive ? (
                    sortConfig?.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                ) : (
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
             </span>
          </div>
        </th>
     );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* HEADER SECTION */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-4">
        
        {/* Top Row: Title, Search, Filter Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <h2 className="text-lg font-bold text-gray-800">{title || 'Inventory List'}</h2>
               <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
                 {filteredAndSortedItems.length} items
               </span>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative group">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isTyping ? 'text-blue-500' : 'text-gray-400 group-focus-within:text-blue-500'}`} size={18} />
                <input
                  type="text"
                  placeholder="Search part, name, HSN..."
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  className="pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64 transition-all shadow-sm"
                />
                {rawSearch && (
                    <button 
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {isTyping ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    </button>
                )}
              </div>

              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${showAdvancedFilters || selectedHSN !== 'ALL' || priceRange.min || priceRange.max ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                 <Filter size={16} />
                 Filters
                 {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'ALL' ? 'bg-gray-800 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilterType('LOW')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterType === 'LOW' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <AlertTriangle size={12} /> Low Stock
            </button>
            <button
              onClick={() => setFilterType('ZERO')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterType === 'ZERO' ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <AlertCircle size={12} /> Out of Stock
            </button>
            <button
              onClick={() => setFilterType('RECENT_ZERO')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterType === 'RECENT_ZERO' ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Hourglass size={12} /> Recent Stockout
            </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
            <div className="pt-4 border-t border-gray-200 animate-slide-in grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* HSN Filter */}
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">HSN Code</label>
                   <select 
                      value={selectedHSN}
                      onChange={(e) => setSelectedHSN(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                   >
                      <option value="ALL">All Codes</option>
                      {uniqueHSNs.map(hsn => (
                          <option key={hsn} value={hsn}>{hsn}</option>
                      ))}
                   </select>
                </div>

                {/* Price Range */}
                <div className="md:col-span-2">
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Price Range (₹)</label>
                   <div className="flex items-center gap-2">
                       <input 
                         type="number" 
                         placeholder="Min" 
                         value={priceRange.min}
                         onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                         className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                       />
                       <span className="text-gray-400">-</span>
                       <input 
                         type="number" 
                         placeholder="Max" 
                         value={priceRange.max}
                         onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                         className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                       />
                   </div>
                </div>

                {/* Reset Button */}
                <div>
                   <button 
                     onClick={clearAllFilters}
                     className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                   >
                      <RefreshCcw size={14} /> Clear All
                   </button>
                </div>
            </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 font-semibold border-b border-gray-200 uppercase tracking-wider text-xs">
            <tr>
              <SortHeader label="Part No." columnKey="partNumber" />
              <SortHeader label="Name" columnKey="name" />
              <SortHeader label="Brand" columnKey="brand" />
              <SortHeader label="HSN CD" columnKey="hsnCode" />
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors group select-none text-right"
                onClick={() => requestSort('price')}
              >
                 <div className={`flex items-center justify-end gap-2 ${sortConfig?.key === 'price' ? 'text-blue-700' : 'text-gray-500'}`}>
                    Price
                    <span className="flex flex-col">
                        {sortConfig?.key === 'price' ? (
                            sortConfig?.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                            <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        )}
                    </span>
                 </div>
              </th>
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors group select-none text-center"
                onClick={() => requestSort('quantity')}
              >
                 <div className={`flex items-center justify-center gap-2 ${sortConfig?.key === 'quantity' ? 'text-blue-700' : 'text-gray-500'}`}>
                    Stock
                    <span className="flex flex-col">
                        {sortConfig?.key === 'quantity' ? (
                            sortConfig?.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                            <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        )}
                    </span>
                 </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? (
              currentItems.map((item) => {
                const isZero = item.quantity === 0;
                const isLow = item.quantity < item.minStockThreshold;
                const isHyundai = item.brand === Brand.HYUNDAI;
                
                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-gray-50 transition-colors border-l-4 ${isHyundai ? 'border-l-blue-800' : 'border-l-red-600'}`}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-slate-700 hover:text-blue-600 hover:underline flex flex-col">
                        <span className="font-bold">{item.partNumber}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{item.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        isHyundai 
                          ? 'bg-blue-50 text-blue-800 border-blue-100' 
                          : 'bg-red-50 text-red-800 border-red-100'
                      }`}>
                        {item.brand}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{item.hsnCode}</td>
                    <td className="px-6 py-4 text-gray-900 text-right font-medium">₹{item.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                          Low: {item.quantity}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                          {item.quantity}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="text-gray-300" size={32} />
                    <p>No items found matching criteria.</p>
                    <button onClick={clearAllFilters} className="text-blue-600 hover:underline text-sm">Clear all filters</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
           <div className="text-xs text-gray-500">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSortedItems.length)}</span> of <span className="font-medium">{filteredAndSortedItems.length}</span> results
           </div>
           <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition-all shadow-sm disabled:shadow-none"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <span className="text-xs font-medium text-gray-700 bg-white px-3 py-1.5 rounded border border-gray-200">
                 Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition-all shadow-sm disabled:shadow-none"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default StockTable;
