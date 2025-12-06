
import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand } from '../types';
import { Search, Filter, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand;
}

const StockTable: React.FC<StockTableProps> = ({ items, title, brandFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'ZERO'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockItem; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 50;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, brandFilter, items, sortConfig]);

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter(item => {
      // Brand Filter
      if (brandFilter && item.brand !== brandFilter) return false;

      // Search Filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.partNumber.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        item.hsnCode.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status Filter
      if (filterType === 'LOW') return item.quantity > 0 && item.quantity < item.minStockThreshold;
      if (filterType === 'ZERO') return item.quantity === 0;

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
  }, [items, searchTerm, filterType, brandFilter, sortConfig]);

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
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-bold text-gray-800">{title || 'Inventory List'}</h2>
           <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
             {filteredAndSortedItems.length} items
           </span>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search part no, name, HSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'ALL' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('LOW')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterType === 'LOW' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <AlertTriangle size={12} /> Low
            </button>
            <button
              onClick={() => setFilterType('ZERO')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${filterType === 'ZERO' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <AlertCircle size={12} /> Zero
            </button>
          </div>
        </div>
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
                    <p>No items found matching your filters.</p>
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
