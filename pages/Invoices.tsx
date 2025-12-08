

import React, { useState, useEffect } from 'react';
import { User, Transaction } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { generateInvoice } from '../services/invoiceService'; // Uses the print logic
import { FileText, Plus, CheckCircle2, History, Printer, Search } from 'lucide-react';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Invoices: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  // Pending State
  const [sales, setSales] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]); // needed for print name lookup
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
    const data = await fetchUninvoicedSales();
    setSales(data);
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
    const taxAmount = totalAmount * 0.18; // Simple 18% assumption for demo, or calculate based on HSN

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
     // NOTE: In a real app, we'd fetch the items linked to this invoice.
     // For this mock, we can't easily fetch the specific lines without another query.
     // Just showing alert for now or rudimentary print.
     alert(`Reprinting Invoice ${invoice.invoiceNumber}... (Implementation requires fetching lines)`);
  };

  const filteredSales = sales.filter(s => 
    s.partNumber.toLowerCase().includes(filter.toLowerCase()) || 
    (s.customerName && s.customerName.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <FileText className="text-indigo-600" /> Tax Invoices
          </h1>
          <p className="text-slate-500">Generate formal invoices for customers from approved sales.</p>
       </div>

       <div className="flex bg-white p-1 rounded-lg border border-slate-200 w-fit">
          <button 
             onClick={() => setActiveTab('PENDING')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'PENDING' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
          >
             Pending Sales
          </button>
          <button 
             onClick={() => setActiveTab('HISTORY')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
          >
             Invoice History
          </button>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'PENDING' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                {/* Left: Sales List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                   <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <div className="relative w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <input 
                            type="text" 
                            placeholder="Filter by part or customer..."
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                         />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase">{selectedIds.size} Selected</span>
                   </div>
                   
                   <div className="flex-1 overflow-auto">
                      {loading ? <div className="p-12 flex justify-center"><TharLoader/></div> : (
                         <table className="w-full text-sm text-left">
                            <thead className="bg-white text-slate-600 font-medium sticky top-0 shadow-sm z-10">
                               <tr>
                                  <th className="px-4 py-3 w-10"></th>
                                  <th className="px-4 py-3">Date</th>
                                  <th className="px-4 py-3">Part No</th>
                                  <th className="px-4 py-3">Billed To</th>
                                  <th className="px-4 py-3 text-right">Amount</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {filteredSales.map(sale => (
                                  <tr 
                                    key={sale.id} 
                                    className={`hover:bg-indigo-50 cursor-pointer transition-colors ${selectedIds.has(sale.id) ? 'bg-indigo-50' : ''}`}
                                    onClick={() => toggleSelect(sale.id)}
                                  >
                                     <td className="px-4 py-3 text-center">
                                        <input 
                                           type="checkbox" 
                                           checked={selectedIds.has(sale.id)} 
                                           readOnly
                                           className="rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                        />
                                     </td>
                                     <td className="px-4 py-3 text-slate-500">
                                        {new Date(sale.createdAt).toLocaleDateString()}
                                        <div className="text-[10px]">{new Date(sale.createdAt).toLocaleTimeString()}</div>
                                     </td>
                                     <td className="px-4 py-3 font-bold text-slate-800">{sale.partNumber} <span className="text-slate-400 font-normal">x {sale.quantity}</span></td>
                                     <td className="px-4 py-3 text-slate-600">{sale.customerName || 'Walk-in'}</td>
                                     <td className="px-4 py-3 text-right font-medium">₹{(sale.price * sale.quantity).toLocaleString()}</td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      )}
                   </div>
                </div>

                {/* Right: Generator Form */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-fit">
                   <div className="p-4 border-b border-slate-200 bg-indigo-50 text-indigo-900 font-bold flex items-center gap-2">
                      <FileText size={18} /> Generate Invoice
                   </div>
                   
                   <div className="p-6 space-y-4">
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-slate-500 uppercase">Customer Name <span className="text-red-500">*</span></label>
                         <input 
                           type="text" 
                           className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                           value={customerName}
                           onChange={e => setCustomerName(e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                         <input 
                           type="text" 
                           className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                           value={customerPhone}
                           onChange={e => setCustomerPhone(e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
                         <textarea 
                           className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                           value={customerAddress}
                           onChange={e => setCustomerAddress(e.target.value)}
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500 uppercase">GST No.</label>
                           <input 
                             type="text" 
                             className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                             value={customerGst}
                             onChange={e => setCustomerGst(e.target.value)}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500 uppercase">Payment</label>
                           <select 
                             className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
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
                   
                   <div className="p-4 bg-slate-50 border-t border-slate-200">
                      <div className="flex justify-between items-end mb-4">
                         <div className="text-xs text-slate-500">{selectedIds.size} items selected</div>
                         <div className="text-right">
                             <div className="text-xs text-slate-500 uppercase font-bold">Total</div>
                             <div className="text-xl font-bold text-indigo-700">
                                ₹{sales.filter(s => selectedIds.has(s.id)).reduce((a,c) => a + (c.price*c.quantity), 0).toLocaleString()}
                             </div>
                         </div>
                      </div>
                      <button 
                        onClick={handleGenerateInvoice}
                        disabled={selectedIds.size === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                         <Printer size={18} /> Create & Print
                      </button>
                   </div>
                </div>
             </div>
          )}
          
          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
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
