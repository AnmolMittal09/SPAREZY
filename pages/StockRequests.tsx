import React, { useEffect, useState } from 'react';
import { User, Role, StockItem, StockRequest, RequestStatus } from '../types';
import { fetchInventory } from '../services/inventoryService';
import { createStockRequests, fetchStockRequests, updateRequestStatus } from '../services/requestService';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShoppingCart, 
  Trash2, 
  Loader2,
  PackagePlus,
  History,
  RefreshCw
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const formatQty = (n: number) => {
  const abs = Math.abs(n);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return n < 0 ? `-${str}` : str;
};

interface Props {
  user: User;
}

const StockRequests: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Manager State
  const [cart, setCart] = useState<{ partNumber: string; name: string; currentStock: number; requestQty: number }[]>([]);
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin/Shared State
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loadingReq, setLoadingReq] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoadingInv(true);
    
    try {
      const inv = await fetchInventory();
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInv(false);
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    setLoadingReq(true);
    const all = await fetchStockRequests();
    if (activeTab === 'PENDING') {
      setRequests(all.filter(r => r.status === RequestStatus.PENDING));
    } else {
      setRequests(all.filter(r => r.status !== RequestStatus.PENDING));
    }
    setLoadingReq(false);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term) {
      setSuggestions([]);
      return;
    }
    const matches = inventory.filter(i => 
      i.partNumber.toLowerCase().includes(term.toLowerCase()) || 
      i.name.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 5);
    setSuggestions(matches);
  };

  const addToRequest = (item: StockItem, qty: number = 5) => {
    if (cart.some(c => c.partNumber === item.partNumber)) return;
    setCart(prev => [...prev, {
      partNumber: item.partNumber,
      name: item.name,
      currentStock: item.quantity,
      requestQty: qty
    }]);
    setSearchTerm('');
    setSuggestions([]);
  };

  const removeFromCart = (partNumber: string) => {
    setCart(prev => prev.filter(c => c.partNumber !== partNumber));
  };

  const updateCartQty = (partNumber: string, qty: number) => {
    setCart(prev => prev.map(c => c.partNumber === partNumber ? { ...c, requestQty: qty } : c));
  };

  const submitRequest = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    
    const payload = cart.map(c => ({
      partNumber: c.partNumber,
      quantity: c.requestQty,
      requesterName: user.name
    }));

    const res = await createStockRequests(payload);
    
    if (res.success) {
      alert("Stock request sent to Admin successfully!");
      setCart([]);
      if (activeTab === 'PENDING') loadRequests();
    } else {
      alert("Failed to send request: " + res.message);
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (ids: string[], status: RequestStatus) => {
    if (!window.confirm(`Mark ${ids.length} items as ${status}?`)) return;
    
    try {
      await updateRequestStatus(ids, status);
      loadRequests();
    } catch (err) {
      alert("Error updating status");
    }
  };

  const lowStockItems = inventory.filter(i => i.quantity <= i.minStockThreshold);

  if (loadingInv && !refreshing) return <TharLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-blue-600" /> Stock Requisition
          </h1>
          <p className="text-gray-500">
            {user.role === Role.MANAGER 
              ? "Request new stock from the Admin." 
              : "Review and process stock requests from Managers."}
          </p>
        </div>
        <button 
           onClick={() => { loadData(true); loadRequests(); }}
           disabled={refreshing || loadingReq}
           className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 transition-all active:scale-95 shadow-sm ${(refreshing || loadingReq) ? 'opacity-50' : ''}`}
        >
           <RefreshCw size={20} className={(refreshing || loadingReq) ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* LEFT COLUMN: MANAGER INPUT */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-orange-50 rounded-xl border border-orange-100 p-5 shadow-sm">
               <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} /> Low Stock Alerts
               </h3>
               <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {lowStockItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No low stock items found.</p>
                  ) : (
                    lowStockItems.map(item => (
                       <div key={item.id} className="bg-white p-3 rounded-lg border border-orange-200 flex justify-between items-center group">
                          <div className="min-w-0">
                             <div className="font-bold text-sm text-gray-800 truncate">{item.partNumber}</div>
                             <div className="text-xs text-red-600 font-bold">{formatQty(item.quantity)} in stock</div>
                          </div>
                          <button 
                            onClick={() => addToRequest(item)}
                            disabled={cart.some(c => c.partNumber === item.partNumber)}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-1.5 rounded-md transition-colors disabled:opacity-50"
                          >
                             <Plus size={16} />
                          </button>
                       </div>
                    ))
                  )}
               </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
               <h3 className="font-bold text-gray-800 mb-3">Manual Add</h3>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input 
                     type="text" 
                     className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                     placeholder="Search Part Number..."
                     value={searchTerm}
                     onChange={e => handleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                     <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {suggestions.map(s => (
                           <div 
                              key={s.id} 
                              onClick={() => addToRequest(s)}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 text-sm"
                           >
                              <div className="font-bold">{s.partNumber}</div>
                              <div className="text-xs text-gray-500">{s.name}</div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col h-fit">
               <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <ShoppingCart size={18} /> Request List ({formatQty(cart.length)})
               </h3>
               
               {cart.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">List is empty.</div>
               ) : (
                  <div className="space-y-3 mb-4">
                     {cart.map(item => (
                        <div key={item.partNumber} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-lg">
                           <div className="flex-1 min-w-0 mr-2">
                              <div className="font-bold truncate">{item.partNumber}</div>
                              <div className="text-xs text-gray-500 truncate">{item.name}</div>
                           </div>
                           <input 
                              type="number" 
                              min="1"
                              className="w-16 px-2 py-1 border rounded text-center text-sm"
                              value={item.requestQty === 0 ? '' : formatQty(item.requestQty)}
                              onChange={(e) => updateCartQty(item.partNumber, parseInt(e.target.value) || 1)}
                           />
                           <button onClick={() => removeFromCart(item.partNumber)} className="ml-2 text-gray-400 hover:text-red-500">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     ))}
                  </div>
               )}

               <button 
                  onClick={submitRequest}
                  disabled={cart.length === 0 || submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-auto"
               >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
                  Send Request
               </button>
            </div>
         </div>

         {/* RIGHT COLUMN: REQUEST LIST */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 w-fit">
               <button 
                 onClick={() => setActiveTab('PENDING')}
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'PENDING' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 Pending Requests
               </button>
               <button 
                 onClick={() => setActiveTab('HISTORY')}
                 className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-gray-100 text-gray-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 History
               </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
               {loadingReq ? (
                  <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
               ) : requests.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                     <History className="mb-2 opacity-20" size={48} />
                     <p>No {activeTab.toLowerCase()} requests found.</p>
                  </div>
               ) : (
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                           <tr>
                              <th className="px-6 py-4">Requested By</th>
                              <th className="px-6 py-4">Part No</th>
                              <th className="px-6 py-4 text-center">Qty Needed</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                <th className="px-6 py-4 text-right">Action</th>
                              )}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {requests.map(req => (
                              <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                 <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{req.requesterName || 'Manager'}</div>
                                    <div className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                                 </td>
                                 <td className="px-6 py-4 font-mono font-medium">{req.partNumber}</td>
                                 <td className="px-6 py-4 text-center font-bold">{formatQty(req.quantityNeeded)}</td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                       req.status === RequestStatus.PENDING ? 'bg-yellow-100 text-yellow-800' :
                                       req.status === RequestStatus.ORDERED ? 'bg-green-100 text-green-800' :
                                       'bg-red-100 text-red-800'
                                    }`}>
                                       {req.status}
                                    </span>
                                 </td>
                                 {user.role === Role.OWNER && activeTab === 'PENDING' && (
                                    <td className="px-6 py-4 text-right">
                                       <div className="flex justify-end gap-2">
                                          <button 
                                             onClick={() => handleStatusChange([req.id], RequestStatus.ORDERED)}
                                             className="bg-green-50 hover:bg-green-100 text-green-700 p-2 rounded-lg transition-colors border border-green-200"
                                             title="Mark as Ordered"
                                          >
                                             <CheckCircle2 size={16} />
                                          </button>
                                          <button 
                                             onClick={() => handleStatusChange([req.id], RequestStatus.REJECTED)}
                                             className="bg-red-50 hover:bg-red-100 text-red-700 p-2 rounded-lg transition-colors border border-red-200"
                                             title="Reject"
                                          >
                                             <XCircle size={16} />
                                          </button>
                                       </div>
                                    </td>
                                 )}
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default StockRequests;