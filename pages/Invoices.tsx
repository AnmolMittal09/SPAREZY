
import React, { useState, useEffect, useRef } from 'react';
import { User, Transaction, ShopSettings } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getShopSettings } from '../services/masterService';
import { numberToWords } from '../services/invoiceService'; 
import { FileText, Printer, Search, RefreshCw, AlertCircle, CheckCircle2, History, ArrowRight, User as UserIcon, MapPin, Phone, CreditCard, ChevronLeft } from 'lucide-react';
import TharLoader from '../components/TharLoader';
import Logo from '../components/Logo';

interface Props {
  user: User;
}

const Invoices: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  // Workflow State
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select, 2: Details, 3: Preview
  
  // Data State
  const [sales, setSales] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);

  // Form State
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    address: '',
    gst: '',
    paymentMode: 'CASH'
  });

  useEffect(() => {
    fetchInventory().then(setInventory);
    getShopSettings().then(setShopSettings);
  }, []);

  useEffect(() => {
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

  // --- CALCULATIONS ---
  const selectedItems = sales.filter(s => selectedIds.has(s.id)).map(sale => {
    const stockItem = inventory.find(i => i.partNumber.toLowerCase() === sale.partNumber.toLowerCase());
    return {
      ...sale,
      name: stockItem ? stockItem.name : 'Spare Part'
    };
  });

  const subTotal = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const taxRate = shopSettings ? shopSettings.defaultTaxRate : 18;
  const taxableValue = subTotal / (1 + (taxRate/100)); // Assuming Price is MRP (Inclusive)
  const taxAmount = subTotal - taxableValue;
  const grandTotal = subTotal; // Rounded handled in display

  const handleConfirmAndPrint = async () => {
    if (!customerDetails.name) return alert("Customer Name is required");
    
    // 1. Save to DB
    const result = await generateTaxInvoiceRecord(
      Array.from(selectedIds),
      customerDetails,
      { amount: grandTotal, tax: taxAmount },
      user.role
    );

    if (result.success && result.invoice) {
      // 2. Trigger Browser Print
      window.print();

      // 3. Reset
      setTimeout(() => {
        alert("Invoice Saved & Sent to Printer!");
        setStep(1);
        setSelectedIds(new Set());
        setCustomerDetails({ name: '', phone: '', address: '', gst: '', paymentMode: 'CASH' });
        loadPending();
      }, 500);
    } else {
      alert("Failed to save invoice: " + result.message);
    }
  };

  // --- PREVIEW COMPONENT ---
  const InvoicePreview = () => (
    <div id="invoice-preview" className="bg-white text-slate-900 p-8 md:p-12 max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:m-0 print:p-8 relative">
      
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
         <div className="w-1/2">
            <Logo className="h-16 w-auto mb-4" />
            <div className="text-sm space-y-1 text-slate-600">
               <p className="font-bold text-slate-900 text-lg">{shopSettings?.name || 'SPAREZY AUTO PARTS'}</p>
               <p className="whitespace-pre-line">{shopSettings?.address || 'Shop Address Not Configured'}</p>
               <p>Phone: {shopSettings?.phone || 'N/A'}</p>
               <p>GSTIN: {shopSettings?.gst || 'N/A'}</p>
            </div>
         </div>
         <div className="w-1/2 text-right">
            <h1 className="text-4xl font-black text-slate-200 uppercase tracking-widest mb-2">Invoice</h1>
            <div className="space-y-1 text-sm">
               <p><span className="font-bold text-slate-500 uppercase text-xs mr-2">Date:</span> {new Date().toLocaleDateString()}</p>
               <p><span className="font-bold text-slate-500 uppercase text-xs mr-2">Time:</span> {new Date().toLocaleTimeString()}</p>
               <p><span className="font-bold text-slate-500 uppercase text-xs mr-2">Mode:</span> {customerDetails.paymentMode}</p>
            </div>
         </div>
      </div>

      {/* Bill To */}
      <div className="flex justify-between mb-8">
         <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
            <p className="font-bold text-lg">{customerDetails.name}</p>
            {customerDetails.address && <p className="text-sm text-slate-600 max-w-xs">{customerDetails.address}</p>}
            {customerDetails.phone && <p className="text-sm text-slate-600">Ph: {customerDetails.phone}</p>}
            {customerDetails.gst && <p className="text-sm text-slate-600">GST: {customerDetails.gst}</p>}
         </div>
         {/* Could add QR Code here in future */}
      </div>

      {/* Table */}
      <table className="w-full text-sm mb-8">
         <thead>
            <tr className="border-b-2 border-slate-900">
               <th className="py-2 text-left w-10">#</th>
               <th className="py-2 text-left">Part Description</th>
               <th className="py-2 text-center w-16">Qty</th>
               <th className="py-2 text-right w-24">Price</th>
               <th className="py-2 text-right w-24">Amount</th>
            </tr>
         </thead>
         <tbody className="divide-y divide-slate-100">
            {selectedItems.map((item, idx) => (
               <tr key={idx}>
                  <td className="py-3 text-slate-500">{idx + 1}</td>
                  <td className="py-3">
                     <p className="font-bold text-slate-800">{item.partNumber}</p>
                     <p className="text-xs text-slate-500">{item.name}</p>
                  </td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right">₹{item.price.toFixed(2)}</td>
                  <td className="py-3 text-right font-bold">₹{(item.price * item.quantity).toFixed(2)}</td>
               </tr>
            ))}
         </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-12">
         <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
               <span>Taxable Amount</span>
               <span>₹{taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
               <span>CGST ({(taxRate/2).toFixed(1)}%)</span>
               <span>₹{(taxAmount/2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
               <span>SGST ({(taxRate/2).toFixed(1)}%)</span>
               <span>₹{(taxAmount/2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t-2 border-slate-900 pt-2 mt-2">
               <span>Grand Total</span>
               <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
         </div>
      </div>

      {/* Footer Details */}
      <div className="border-t border-slate-200 pt-6">
         <div className="flex justify-between items-end">
            <div className="max-w-md">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount In Words</p>
               <p className="text-sm font-medium italic text-slate-700 capitalize">
                  {numberToWords(Math.round(grandTotal))}
               </p>
               <p className="text-xs text-slate-400 mt-4">
                  Terms & Conditions: Goods once sold will not be taken back. Warranty as per manufacturer policy only.
               </p>
            </div>
            <div className="text-center">
               <div className="h-16 w-32 mb-2 border-b border-dashed border-slate-300"></div>
               <p className="text-xs font-bold text-slate-900">Authorized Signatory</p>
            </div>
         </div>
      </div>

      {/* Print Watermark */}
      <div className="absolute bottom-4 left-0 right-0 text-center print:block hidden">
         <p className="text-[10px] text-slate-300">Generated by Sparezy Stock Management System</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 h-full flex flex-col relative">
       {/* Inject Print Styles */}
       <style>{`
         @media print {
           body * { visibility: hidden; }
           #invoice-preview, #invoice-preview * { visibility: visible; }
           #invoice-preview { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; }
           @page { margin: 0; size: auto; }
         }
       `}</style>

       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
             <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-indigo-600" /> Tax Invoices
             </h1>
             <p className="text-slate-500">Generate formal invoices for recorded sales.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <button 
                onClick={() => { setActiveTab('PENDING'); setStep(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'PENDING' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <CheckCircle2 size={16} /> Generate New
             </button>
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <History size={16} /> History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'PENDING' && (
             <>
               {/* Stepper Header (No Print) */}
               <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-center gap-4 no-print">
                  <div className={`flex items-center gap-2 text-sm font-bold ${step >= 1 ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
                     Select Sales
                  </div>
                  <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <div className={`flex items-center gap-2 text-sm font-bold ${step >= 2 ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
                     Details
                  </div>
                  <div className={`w-12 h-0.5 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <div className={`flex items-center gap-2 text-sm font-bold ${step >= 3 ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
                     Preview & Print
                  </div>
               </div>

               {/* Step 1: SELECT SALES */}
               {step === 1 && (
                 <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 p-6 animate-fade-in no-print">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-w-5xl mx-auto w-full h-full">
                       <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-700">Pending Uninvoiced Sales</h3>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                placeholder="Filter list..." 
                                className="border rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                             />
                             <button onClick={loadPending} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw size={16}/></button>
                          </div>
                       </div>
                       
                       <div className="flex-1 overflow-auto">
                          {sales.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <AlertCircle size={48} className="mb-4 opacity-20" />
                                <p>No pending sales found.</p>
                             </div>
                          ) : (
                             <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                   <tr>
                                      <th className="px-6 py-3 w-16 text-center">Select</th>
                                      <th className="px-6 py-3">Date</th>
                                      <th className="px-6 py-3">Customer</th>
                                      <th className="px-6 py-3">Item</th>
                                      <th className="px-6 py-3 text-right">Amount</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                   {sales.filter(s => s.partNumber.toLowerCase().includes(filter.toLowerCase()) || s.customerName?.toLowerCase().includes(filter.toLowerCase())).map(sale => (
                                      <tr key={sale.id} className={`hover:bg-indigo-50 cursor-pointer ${selectedIds.has(sale.id) ? 'bg-indigo-50' : ''}`} onClick={() => toggleSelect(sale.id)}>
                                         <td className="px-6 py-4 text-center">
                                            <input type="checkbox" checked={selectedIds.has(sale.id)} readOnly className="w-4 h-4 text-indigo-600 rounded" />
                                         </td>
                                         <td className="px-6 py-4 text-slate-500">{new Date(sale.createdAt).toLocaleDateString()}</td>
                                         <td className="px-6 py-4 font-medium">{sale.customerName || 'Walk-in'}</td>
                                         <td className="px-6 py-4">
                                            <div className="font-bold">{sale.partNumber}</div>
                                            <div className="text-xs text-slate-400">Qty: {sale.quantity}</div>
                                         </td>
                                         <td className="px-6 py-4 text-right font-bold">₹{(sale.price * sale.quantity).toLocaleString()}</td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          )}
                       </div>

                       <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                          <span className="text-slate-500 text-sm">Selected: <b>{selectedIds.size}</b> items</span>
                          <button 
                             disabled={selectedIds.size === 0}
                             onClick={() => setStep(2)}
                             className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
                          >
                             Next Step <ArrowRight size={16} />
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               {/* Step 2: CUSTOMER DETAILS */}
               {step === 2 && (
                  <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 animate-fade-in no-print">
                     <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 bg-indigo-50 flex items-center gap-3">
                           <UserIcon className="text-indigo-600" />
                           <div>
                              <h3 className="font-bold text-indigo-900 text-lg">Customer Information</h3>
                              <p className="text-xs text-indigo-600">Enter details for the invoice.</p>
                           </div>
                        </div>

                        <div className="p-8 space-y-6">
                           <div className="grid grid-cols-2 gap-6">
                              <div className="col-span-2">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Name <span className="text-red-500">*</span></label>
                                 <div className="relative">
                                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                       autoFocus
                                       type="text" 
                                       className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                       placeholder="Enter Full Name"
                                       value={customerDetails.name}
                                       onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})}
                                    />
                                 </div>
                              </div>

                              <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                 <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                       type="text" 
                                       className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                       placeholder="Optional"
                                       value={customerDetails.phone}
                                       onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}
                                    />
                                 </div>
                              </div>

                              <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN</label>
                                 <input 
                                    type="text" 
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Optional"
                                    value={customerDetails.gst}
                                    onChange={e => setCustomerDetails({...customerDetails, gst: e.target.value})}
                                 />
                              </div>

                              <div className="col-span-2">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Address</label>
                                 <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <textarea 
                                       className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                       rows={3}
                                       placeholder="Enter Address"
                                       value={customerDetails.address}
                                       onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})}
                                    />
                                 </div>
                              </div>

                              <div className="col-span-2">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
                                 <div className="grid grid-cols-4 gap-3">
                                    {['CASH', 'UPI', 'CARD', 'CREDIT'].map(mode => (
                                       <button
                                          key={mode}
                                          onClick={() => setCustomerDetails({...customerDetails, paymentMode: mode})}
                                          className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                                             customerDetails.paymentMode === mode 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                          }`}
                                       >
                                          {mode}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between">
                           <button onClick={() => setStep(1)} className="text-slate-500 font-bold hover:text-slate-800 flex items-center gap-2">
                              <ChevronLeft size={16} /> Back
                           </button>
                           <button 
                              disabled={!customerDetails.name}
                              onClick={() => setStep(3)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                           >
                              Generate Preview <ArrowRight size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {/* Step 3: PREVIEW */}
               {step === 3 && (
                  <div className="flex-1 flex flex-col md:flex-row bg-slate-100 overflow-hidden">
                     {/* Preview Container */}
                     <div className="flex-1 overflow-auto p-8 flex justify-center">
                        <InvoicePreview />
                     </div>

                     {/* Sidebar Actions (No Print) */}
                     <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 shadow-xl z-20 no-print">
                        <div>
                           <h3 className="font-bold text-slate-800 text-lg mb-1">Confirm & Print</h3>
                           <p className="text-sm text-slate-500">Review the invoice before finalizing.</p>
                        </div>
                        
                        <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                           <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Items</span>
                              <span className="font-bold">{selectedItems.length}</span>
                           </div>
                           <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Total</span>
                              <span className="font-bold text-indigo-600">₹{grandTotal.toLocaleString()}</span>
                           </div>
                        </div>

                        <div className="mt-auto space-y-3">
                           <button 
                              onClick={handleConfirmAndPrint}
                              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                           >
                              <Printer size={20} /> Print Invoice
                           </button>
                           <button 
                              onClick={() => setStep(2)}
                              className="w-full bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
                           >
                              Edit Details
                           </button>
                        </div>
                     </div>
                  </div>
               )}
             </>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden m-4 no-print">
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
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {invoiceHistory.map(inv => (
                               <tr key={inv.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-4 font-bold text-slate-800">{inv.invoiceNumber}</td>
                                  <td className="px-6 py-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                                  <td className="px-6 py-4">
                                     <div className="font-medium text-slate-800">{inv.customerName}</div>
                                  </td>
                                  <td className="px-6 py-4">{inv.itemsCount}</td>
                                  <td className="px-6 py-4 text-right font-bold text-indigo-700">₹{inv.totalAmount.toLocaleString()}</td>
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
