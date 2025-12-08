
import React, { useState, useEffect } from 'react';
import { User, Transaction } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { generateInvoice } from '../services/invoiceService'; // Uses the print logic
import { FileText, Printer, Search, RefreshCw, AlertCircle, CheckCircle2, History } from 'lucide-react';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Invoices: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  // Pending State
  const [sales, setSales] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');

  // History State
  const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchInventory().then(setInventory);
    if (activeTab === 'PENDING') loadPending();
    else loadHistory();
  }, [activeTab]);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await fetchUninvoicedSales();
      setSales(data);
    } catch (error) {
      console.error("Failed to load sales", error);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchInvoices();
    setInvoiceHistory(data);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleGenerateInvoice = async () => {
    if (selectedIds.size === 0) return;
    if (!customerName) {
      alert("Customer Name is required for Tax Invoice.");
      return;
    }

    const selectedItems = sales.filter(s => selectedIds.has(s.id));
    const totalAmount = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const taxAmount = totalAmount * 0.18; // Simple 18% assumption, real logic would sum tax per item

    const result = await generateTaxInvoiceRecord(
      Array.from(selectedIds),
      { name: customerName, phone: customerPhone, address: customerAddress, gst: customerGst, paymentMode },
      { amount: totalAmount, tax: taxAmount },
      user.role
    );

    if (result.success && result.invoice) {
      alert(`Invoice ${result.invoice.invoiceNumber} Generated Successfully!`);
      
      // Auto Print
      const printItems = selectedItems.map(s => ({
        partNumber: s.partNumber,
        quantity: s.quantity,
        price: s.price,
        customerName: customerName
      }));
      generateInvoice(printItems, inventory);

      // Reset
      setSelectedIds(new Set());
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerGst('');
      loadPending();
    } else {
      alert("Error: " + result.message);
    }
  };

  const handleReprint = (invoice: any) => {
     alert(`Reprinting Invoice ${invoice.invoiceNumber}... (Implementation requires fetching linked lines)`);
  };

  const filteredSales = sales.filter(s => 
    s.partNumber.toLowerCase().includes(filter.toLowerCase()) || 
    (s.customerName && s.customerName.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-indigo-600" /> Tax Invoices
             </h1>
             <p className="text-slate-500">Generate formal invoices for recorded sales.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <button 
                onClick={() => setActiveTab('PENDING')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'PENDING' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <CheckCircle2 size={16} /> Uninvoiced Sales
             </button>
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <History size={16} /> Invoice History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'PENDING' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                {/* Left: Sales List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                   <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                      <div className="relative flex-1 max-w-md">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <input 
                            type="text" 
                            placeholder="Search sales by part or customer..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                         />
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={loadPending} 
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Refresh List"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                        <span className="text-xs font-bold text-slate-500 uppercase bg-slate-200 px-2 py-1 rounded">{selectedIds.size} Selected</span>
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-auto bg-slate-50/50">
                      {loading ? <div className="p-12 flex justify-center"><TharLoader/></div> : (
                         sales.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 px-4 text-center">
                                <AlertCircle size={48} className="mb-4 opacity-20" />
                                <h3 className="text-lg font-semibold text-slate-600">No Pending Sales Found</h3>
                                <p className="text-sm max-w-xs mt-2">
                                    Sales must be <b>Approved</b> and <b>Uninvoiced</b> to appear here. 
                                    Check the <span className="font-bold text-slate-600">Approvals</span> page if you are waiting for manager requests.
                                </p>
                            </div>
                         ) : (
                             <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-white text-slate-600 font-medium sticky top-0 shadow-sm z-10">
                                   <tr>
                                      <th className="px-4 py-3 w-10 border-b border-slate-200">
                                          {/* Header Checkbox could go here for select all */}
                                      </th>
                                      <th className="px-4 py-3 border-b border-slate-200">Date</th>
                                      <th className="px-4 py-3 border-b border-slate-200">Part Details</th>
                                      <th className="px-4 py-3 border-b border-slate-200">Customer</th>
                                      <th className="px-4 py-3 border-b border-slate-200 text-right">Amount</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                   {filteredSales.map(sale => (
                                      <tr 
                                        key={sale.id} 
                                        className={`hover:bg-indigo-50 cursor-pointer transition-colors ${selectedIds.has(sale.id) ? 'bg-indigo-50/80' : ''}`}
                                        onClick={() => toggleSelect(sale.id)}
                                      >
                                         <td className="px-4 py-3 text-center">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(sale.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                {selectedIds.has(sale.id) && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                         </td>
                                         <td className="px-4 py-3 text-slate-500">
                                            <span className="font-medium text-slate-700">{new Date(sale.createdAt).toLocaleDateString()}</span>
                                            <div className="text-[10px] uppercase tracking-wide">{new Date(sale.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                         </td>
                                         <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900">{sale.partNumber}</div>
                                            <div className="text-xs text-slate-500">Qty: {sale.quantity} @ ₹{sale.price}</div>
                                         </td>
                                         <td className="px-4 py-3 text-slate-600">
                                            {sale.customerName || <span className="italic opacity-50">Walk-in</span>}
                                         </td>
                                         <td className="px-4 py-3 text-right font-bold text-slate-800">
                                            ₹{(sale.price * sale.quantity).toLocaleString()}
                                         </td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                         )
                      )}
                   </div>
                </div>

                {/* Right: Generator Form */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-fit sticky top-4">
                   <div className="p-4 border-b border-slate-200 bg-indigo-50 text-indigo-900 font-bold flex items-center gap-2 rounded-t-xl">
                      <FileText size={18} /> Invoice Details
                   </div>
                   
                   <div className="p-5 space-y-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Name <span className="text-red-500">*</span></label>
                         <input 
                           type="text" 
                           className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                           placeholder="Enter Name"
                           value={customerName}
                           onChange={e => setCustomerName(e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                         <input 
                           type="text" 
                           className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                           placeholder="Optional"
                           value={customerPhone}
                           onChange={e => setCustomerPhone(e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billing Address</label>
                         <textarea 
                           className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-16"
                           placeholder="Optional"
                           value={customerAddress}
                           onChange={e => setCustomerAddress(e.target.value)}
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GSTIN</label>
                           <input 
                             type="text" 
                             className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                             placeholder="Optional"
                             value={customerGst}
                             onChange={e => setCustomerGst(e.target.value)}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mode</label>
                           <select 
                             className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all"
                             value={paymentMode}
                             onChange={e => setPaymentMode(e.target.value)}
                           >
                              <option value="CASH">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="CARD">Card</option>
                              <option value="CREDIT">Credit</option>
                           </select>
                        </div>
                      </div>
                   </div>
                   
                   <div className="p-5 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                      <div className="flex justify-between items-end mb-4">
                         <div className="text-xs text-slate-500 font-medium">{selectedIds.size} items selected</div>
                         <div className="text-right">
                             <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Amount</div>
                             <div className="text-2xl font-bold text-indigo-700 leading-none">
                                ₹{sales.filter(s => selectedIds.has(s.id)).reduce((a,c) => a + (c.price*c.quantity), 0).toLocaleString()}
                             </div>
                         </div>
                      </div>
                      <button 
                        onClick={handleGenerateInvoice}
                        disabled={selectedIds.size === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:transform-none flex justify-center items-center gap-2"
                      >
                         <Printer size={18} /> Generate Invoice
                      </button>
                   </div>
                </div>
             </div>
          )}
          
          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-700">Past Invoices</span>
                    <button onClick={loadHistory} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <RefreshCw size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                   {invoiceHistory.length === 0 ? <div className="p-12 text-center text-slate-400">No invoices generated yet.</div> : (
                      <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                            <tr>
                               <th className="px-6 py-4">Invoice #</th>
                               <th className="px-6 py-4">Date</th>
                               <th className="px-6 py-4">Customer</th>
                               <th className="px-6 py-4">Items</th>
                               <th className="px-6 py-4 text-right">Total</th>
                               <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {invoiceHistory.map(inv => (
                               <tr key={inv.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-4 font-bold text-slate-800">{inv.invoiceNumber}</td>
                                  <td className="px-6 py-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                                  <td className="px-6 py-4">
                                     <div className="font-medium text-slate-800">{inv.customerName}</div>
                                     <div className="text-xs text-slate-400">{inv.customerPhone}</div>
                                  </td>
                                  <td className="px-6 py-4">{inv.itemsCount}</td>
                                  <td className="px-6 py-4 text-right font-bold text-indigo-700">₹{inv.totalAmount.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                     <button 
                                       onClick={() => handleReprint(inv)}
                                       className="text-indigo-600 hover:text-indigo-800 font-medium text-xs hover:underline"
                                     >
                                        Reprint
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Invoices;
