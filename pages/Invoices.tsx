import React, { useState, useEffect } from 'react';
import { User, Transaction, ShopSettings, TransactionStatus, TransactionType } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices, fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getShopSettings } from '../services/masterService';
import { numberToWords } from '../services/invoiceService'; 
import { FileText, Printer, Search, RefreshCw, AlertCircle, CheckCircle2, History, ArrowRight, User as UserIcon, MapPin, Phone, CreditCard, ChevronLeft, AlertTriangle, Wallet, Banknote, Building2 } from 'lucide-react';
import TharLoader from '../components/TharLoader';
import Logo from '../components/Logo';
// @ts-ignore
import { useNavigate } from 'react-router-dom';

interface Props {
  user: User;
}

const Invoices: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
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
  
  // Diagnostic State
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

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
    checkPendingApprovals();
  }, []);

  useEffect(() => {
    if (activeTab === 'PENDING') loadPending();
    else loadHistory();
  }, [activeTab]);

  const checkPendingApprovals = async () => {
    try {
      const pendingSales = await fetchTransactions(TransactionStatus.PENDING, TransactionType.SALE);
      setPendingApprovalCount(pendingSales.length);
    } catch (e) {
      console.error("Error checking approvals:", e);
    }
  };

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await fetchUninvoicedSales();
      setSales(data);
    } catch (e) {
      console.error("Error loading pending sales:", e);
      setSales([]);
    } finally {
      setLoading(false);
    }
    checkPendingApprovals();
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      setInvoiceHistory(data);
    } catch (e) {
      console.error("Error loading history:", e);
      setInvoiceHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectedItems = sales.filter(s => selectedIds.has(s.id)).map(sale => {
    const stockItem = inventory.find(i => i.partNumber.toLowerCase() === sale.partNumber.toLowerCase());
    return {
      ...sale,
      name: stockItem ? stockItem.name : 'Spare Part'
    };
  });

  const subTotal = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const taxRate = shopSettings ? shopSettings.defaultTaxRate : 18;
  const taxableValue = subTotal / (1 + (taxRate/100)); 
  const taxAmount = subTotal - taxableValue;
  const grandTotal = subTotal; 

  const handleConfirmAndPrint = async () => {
    if (!customerDetails.name) return alert("Customer Name is required");
    
    const result = await generateTaxInvoiceRecord(
      Array.from(selectedIds),
      customerDetails,
      { amount: grandTotal, tax: taxAmount },
      user.role
    );

    if (result.success && result.invoice) {
      window.print();
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

  // --- BRANDED INVOICE PREVIEW ---
  const InvoicePreview = () => (
    <div id="invoice-preview" className="bg-white text-slate-800 p-10 max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:m-0 print:p-8 relative flex flex-col">
      
      {/* 1. Branded Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
         <div className="flex flex-col gap-4">
            <div className="scale-90 origin-top-left">
                <Logo />
            </div>
            <div className="text-sm space-y-1 text-slate-600 pl-1">
               <p className="font-bold text-slate-900 text-lg">{shopSettings?.name || 'SPAREZY AUTO PARTS'}</p>
               <p className="whitespace-pre-line max-w-xs">{shopSettings?.address || 'Shop Address Not Configured'}</p>
               <p><span className="font-semibold">Phone:</span> {shopSettings?.phone || 'N/A'}</p>
               <p><span className="font-semibold">GSTIN:</span> {shopSettings?.gst || 'N/A'}</p>
            </div>
         </div>
         <div className="text-right">
            <h1 className="text-4xl font-black text-blue-700 uppercase tracking-widest mb-2">Invoice</h1>
            <div className="space-y-1.5 text-sm">
                <p><span className="font-bold text-slate-500 uppercase text-xs mr-3">Date:</span> <span className="font-mono font-bold">{new Date().toLocaleDateString()}</span></p>
                <p><span className="font-bold text-slate-500 uppercase text-xs mr-3">Time:</span> <span className="font-mono">{new Date().toLocaleTimeString()}</span></p>
                <p><span className="font-bold text-slate-500 uppercase text-xs mr-3">Mode:</span> <span className="font-bold bg-slate-100 px-2 py-0.5 rounded">{customerDetails.paymentMode}</span></p>
            </div>
         </div>
      </div>

      {/* 2. Customer & Meta */}
      <div className="flex justify-between mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
         <div>
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-bold text-xl text-slate-900">{customerDetails.name}</p>
            {customerDetails.address && <p className="text-sm text-slate-600 mt-1 max-w-sm">{customerDetails.address}</p>}
            <div className="mt-2 space-y-0.5">
                {customerDetails.phone && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-400 text-xs uppercase w-12 inline-block">Phone</span> {customerDetails.phone}</p>}
                {customerDetails.gst && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-400 text-xs uppercase w-12 inline-block">GSTIN</span> {customerDetails.gst}</p>}
            </div>
         </div>
      </div>

      {/* 3. Items Table */}
      <div className="flex-1">
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="bg-slate-900 text-white">
                <th className="py-3 px-4 text-left w-12 font-bold rounded-tl-lg">#</th>
                <th className="py-3 px-4 text-left font-bold">Item Description</th>
                <th className="py-3 px-4 text-center w-24 font-bold">Qty</th>
                <th className="py-3 px-4 text-right w-32 font-bold">Price</th>
                <th className="py-3 px-4 text-right w-32 font-bold rounded-tr-lg">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-x border-b border-slate-200">
                {selectedItems.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-3 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 text-base">{item.partNumber}</p>
                        <p className="text-xs text-slate-500">{item.name}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{item.quantity}</td>
                    <td className="py-3 px-4 text-right text-slate-600">₹{item.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* 4. Totals & Signature */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-end gap-12">
         <div className="w-full md:w-1/2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amount In Words</p>
            <div className="bg-slate-100 p-3 rounded-lg text-sm font-medium italic text-slate-700 capitalize border border-slate-200">
                {numberToWords(Math.round(grandTotal))}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
               Declarations: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods once sold will not be taken back.
            </p>
         </div>

         <div className="w-full md:w-1/3">
            <div className="space-y-3 pb-4 border-b border-slate-200">
                <div className="flex justify-between text-sm text-slate-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">₹{taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                    <span>Total Tax ({(taxRate).toFixed(0)}%)</span>
                    <span className="font-mono">₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
            <div className="flex justify-between text-xl font-black text-blue-700 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
               <span>Grand Total</span>
               <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            
            <div className="mt-12 text-center">
               <p className="text-xs font-bold text-slate-900 uppercase">Authorized Signatory</p>
            </div>
         </div>
      </div>

      {/* 5. Branding Footer */}
      <div className="mt-auto pt-8 text-center print:block">
         <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
               Generated using Sparezy <span className="text-slate-300">|</span> Smart Inventory Management System
            </p>
         </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col relative">
       {/* Inject Print Styles */}
       <style>{`
         @media print {
           body * { visibility: hidden; }
           #invoice-preview, #invoice-preview * { visibility: visible; }
           #invoice-preview { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; border: none; }
           @page { margin: 0; size: auto; }
         }
       `}</style>

       {/* --- HEADER --- */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print bg-white p-4 md:p-0 md:bg-transparent border-b md:border-none border-slate-100">
          <div>
             <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" /> Invoice Generator
             </h1>
             <p className="text-slate-500 text-sm">Create and print tax invoices for sales.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
             <button 
                onClick={() => { setActiveTab('PENDING'); setStep(1); }}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'PENDING' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                <CheckCircle2 size={16} /> New Invoice
             </button>
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                <History size={16} /> History
             </button>
          </div>
       </div>

       {/* PENDING APPROVAL ALERT */}
       {pendingApprovalCount > 0 && activeTab === 'PENDING' && (
         <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm animate-fade-in no-print gap-3">
            <div className="flex items-center gap-3">
               <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                  <AlertTriangle size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-bold text-amber-900">Attention Needed</h3>
                  <p className="text-xs text-amber-800">{pendingApprovalCount} sales need approval before invoicing.</p>
               </div>
            </div>
            <button 
               onClick={() => navigate('/approvals')}
               className="bg-white border border-amber-200 text-amber-800 text-xs font-bold px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors w-full md:w-auto"
            >
               Go to Approvals
            </button>
         </div>
       )}

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'PENDING' && (
             <>
               {/* STEPPER */}
               <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-center gap-2 md:gap-4 no-print shadow-sm z-10">
                  <div className={`flex items-center gap-2 text-xs md:text-sm font-bold ${step >= 1 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step >= 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-400'}`}>1</span>
                     <span className="hidden md:inline">Select Sales</span>
                  </div>
                  <div className={`w-8 md:w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-100'}`}></div>
                  <div className={`flex items-center gap-2 text-xs md:text-sm font-bold ${step >= 2 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step >= 2 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-400'}`}>2</span>
                     <span className="hidden md:inline">Details</span>
                  </div>
                  <div className={`w-8 md:w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-100'}`}></div>
                  <div className={`flex items-center gap-2 text-xs md:text-sm font-bold ${step >= 3 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step >= 3 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-400'}`}>3</span>
                     <span className="hidden md:inline">Print</span>
                  </div>
               </div>

               {/* Step 1: SELECT SALES */}
               {step === 1 && (
                 <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 p-4 md:p-6 animate-fade-in no-print">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-w-5xl mx-auto w-full h-full">
                       <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2">
                             <RefreshCw size={16} className="text-slate-400" /> Pending Sales
                          </h3>
                          <div className="relative">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <input 
                                type="text" 
                                placeholder="Search..." 
                                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 md:w-48 bg-white"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                             />
                          </div>
                       </div>
                       
                       <div className="flex-1 overflow-auto bg-slate-50 p-3">
                          {sales.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <AlertCircle size={48} className="mb-4 opacity-10" />
                                <p className="font-medium">No pending sales found</p>
                                <p className="text-xs mt-1">Sales must be APPROVED to appear here.</p>
                             </div>
                          ) : (
                             <div className="space-y-2">
                                {sales.filter(s => s.partNumber.toLowerCase().includes(filter.toLowerCase()) || s.customerName?.toLowerCase().includes(filter.toLowerCase())).map(sale => {
                                   const isSelected = selectedIds.has(sale.id);
                                   return (
                                      <div 
                                        key={sale.id} 
                                        onClick={() => toggleSelect(sale.id)}
                                        className={`bg-white p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${
                                           isSelected 
                                             ? 'border-blue-500 ring-1 ring-blue-500 shadow-md z-10' 
                                             : 'border-slate-200 hover:border-blue-300 shadow-sm'
                                        }`}
                                      >
                                         <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                               <CheckCircle2 size={14} />
                                            </div>
                                            <div>
                                               <div className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                                                  {sale.partNumber}
                                                  <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                     {new Date(sale.createdAt).toLocaleDateString()}
                                                  </span>
                                               </div>
                                               <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                  <UserIcon size={12} /> {sale.customerName || 'Walk-in Customer'}
                                               </div>
                                            </div>
                                         </div>
                                         <div className="text-right">
                                            <div className="font-bold text-slate-900">₹{(sale.price * sale.quantity).toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">{sale.quantity} units x ₹{sale.price}</div>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          )}
                       </div>

                       <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shadow-lg z-20">
                          <div>
                             <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Selected</p>
                             <p className="text-xl font-bold text-slate-900">{selectedIds.size} <span className="text-sm font-medium text-slate-400">items</span></p>
                          </div>
                          <button 
                             disabled={selectedIds.size === 0}
                             onClick={() => setStep(2)}
                             className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:shadow-none shadow-lg shadow-blue-200 transition-all active:scale-95"
                          >
                             Next Step <ArrowRight size={18} />
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               {/* Step 2: CUSTOMER DETAILS */}
               {step === 2 && (
                  <div className="flex-1 overflow-auto bg-slate-50 p-4 md:p-8 animate-fade-in no-print flex justify-center">
                     <div className="w-full max-w-2xl space-y-6">
                        
                        {/* Summary Card */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                 <Wallet size={20} />
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-slate-400 uppercase">Invoice Value</p>
                                 <p className="text-lg font-bold text-slate-900">₹{grandTotal.toLocaleString()}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase">{selectedItems.length} Items</p>
                              <button onClick={() => setStep(1)} className="text-xs font-bold text-blue-600 hover:underline">Edit Selection</button>
                           </div>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                           <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                              <UserIcon className="text-blue-600" />
                              <div>
                                 <h3 className="font-bold text-slate-900 text-lg">Customer Profile</h3>
                                 <p className="text-xs text-slate-500">Billing details for the invoice.</p>
                              </div>
                           </div>

                           <div className="p-6 space-y-6">
                              <div className="space-y-4">
                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Full Name <span className="text-red-500">*</span></label>
                                    <div className="relative group">
                                       <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                       <input 
                                          autoFocus
                                          type="text" 
                                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all font-medium"
                                          placeholder="e.g. Rahul Sharma"
                                          value={customerDetails.name}
                                          onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})}
                                       />
                                    </div>
                                 </div>

                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Phone</label>
                                       <div className="relative group">
                                          <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
                                          <input 
                                             type="text" 
                                             className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all font-medium"
                                             placeholder="Mobile No."
                                             value={customerDetails.phone}
                                             onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}
                                          />
                                       </div>
                                    </div>
                                    <div>
                                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">GSTIN</label>
                                       <div className="relative group">
                                          <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
                                          <input 
                                             type="text" 
                                             className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all font-medium"
                                             placeholder="Optional"
                                             value={customerDetails.gst}
                                             onChange={e => setCustomerDetails({...customerDetails, gst: e.target.value})}
                                          />
                                       </div>
                                    </div>
                                 </div>

                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Address</label>
                                    <div className="relative group">
                                       <MapPin size={18} className="absolute left-3 top-4 text-slate-400 group-focus-within:text-blue-500" />
                                       <textarea 
                                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all resize-none font-medium"
                                          rows={2}
                                          placeholder="Billing Address"
                                          value={customerDetails.address}
                                          onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="pt-4 border-t border-slate-100">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Payment Mode</label>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                       { mode: 'CASH', icon: Banknote }, 
                                       { mode: 'UPI', icon: Wallet }, 
                                       { mode: 'CARD', icon: CreditCard }, 
                                       { mode: 'CREDIT', icon: FileText }
                                    ].map(item => (
                                       <button
                                          key={item.mode}
                                          onClick={() => setCustomerDetails({...customerDetails, paymentMode: item.mode})}
                                          className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                                             customerDetails.paymentMode === item.mode 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-offset-2 ring-blue-500' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                          }`}
                                       >
                                          <item.icon size={20} />
                                          <span className="text-xs font-bold">{item.mode}</span>
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>

                           <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                              <button onClick={() => setStep(1)} className="text-slate-500 font-bold hover:text-slate-800 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white transition-colors">
                                 <ChevronLeft size={18} /> Back
                              </button>
                              <button 
                                 disabled={!customerDetails.name}
                                 onClick={() => setStep(3)}
                                 className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-200 active:scale-95"
                              >
                                 Generate Preview <ArrowRight size={18} />
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {/* Step 3: PREVIEW */}
               {step === 3 && (
                  <div className="flex-1 flex flex-col md:flex-row bg-slate-100 overflow-hidden">
                     {/* Preview Container */}
                     <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
                        <InvoicePreview />
                     </div>

                     {/* Sidebar Actions (No Print) */}
                     <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 shadow-xl z-20 no-print">
                        <div>
                           <h3 className="font-bold text-slate-800 text-lg mb-1">Ready to Print</h3>
                           <p className="text-sm text-slate-500">Please review the invoice details before saving.</p>
                        </div>
                        
                        <div className="space-y-4">
                           <button 
                              onClick={handleConfirmAndPrint}
                              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                           >
                              <Printer size={20} /> Confirm & Print
                           </button>
                           <button 
                              onClick={() => setStep(2)}
                              className="w-full bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                           >
                              Edit Details
                           </button>
                        </div>

                        <div className="mt-auto pt-6 border-t border-slate-100">
                           <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                              <AlertCircle size={16} />
                              <p>This action will finalize the invoice and cannot be undone.</p>
                           </div>
                        </div>
                     </div>
                  </div>
               )}
             </>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden m-4 no-print">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                       <History size={18} /> Invoice History
                    </span>
                    <button onClick={loadHistory} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                   {invoiceHistory.length === 0 ? <div className="p-12 text-center text-slate-400">No invoices generated yet.</div> : (
                      <table className="w-full text-sm text-left">
                         <thead className="bg-white text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                            <tr>
                               <th className="px-6 py-4">Invoice #</th>
                               <th className="px-6 py-4">Date</th>
                               <th className="px-6 py-4">Customer</th>
                               <th className="px-6 py-4 text-center">Items</th>
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
                                  <td className="px-6 py-4 text-center">
                                     <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{inv.itemsCount}</span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-blue-700">₹{inv.totalAmount.toLocaleString()}</td>
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