
import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { StockItem, Brand } from '../types';
import { Search, Filter, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  title?: string;
  brandFilter?: Brand;
}

const StockTable: React.FC<StockTableProps> = ({ items, title, brandFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'ZERO'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, brandFilter, items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
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
  }, [items, searchTerm, filterType, brandFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-bold text-gray-800">{title || 'Inventory List'}</h2>
           <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
             {filteredItems.length} items
           </span>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search part no, name, HSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            />
          </div>
          
          <div className="flex gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('LOW')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filterType === 'LOW' ? 'bg-yellow-50 text-yellow-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <AlertTriangle size={12} /> Low
            </button>
            <button
              onClick={() => setFilterType('ZERO')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filterType === 'ZERO' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <AlertCircle size={12} /> Zero
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Part No.</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Brand</th>
              <th className="px-6 py-3">HSN CD</th>
              <th className="px-6 py-3 text-right">Price</th>
              <th className="px-6 py-3 text-center">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? (
              currentItems.map((item) => {
                const isZero = item.quantity === 0;
                const isLow = item.quantity < item.minStockThreshold;
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link to={`/item/${encodeURIComponent(item.partNumber)}`} className="text-blue-600 hover:underline">
                        {item.partNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.brand === Brand.HYUNDAI 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.brand}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{item.hsnCode}</td>
                    <td className="px-6 py-4 text-gray-900 text-right">₹{item.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Low: {item.quantity}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          In Stock: {item.quantity}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No items found matching your filters.
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
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-medium">{filteredItems.length}</span> results
           </div>
           <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <span className="text-xs font-medium text-gray-700">
                 Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
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