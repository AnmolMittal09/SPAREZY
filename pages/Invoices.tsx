
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, ShopSettings, TransactionStatus, TransactionType } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices, fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getShopSettings } from '../services/masterService';
import { numberToWords } from '../services/invoiceService'; 
// Added missing Calendar icon to lucide-react imports
import { FileText, Printer, Search, RefreshCw, AlertCircle, CheckCircle2, History, ArrowRight, User as UserIcon, MapPin, Phone, CreditCard, ChevronLeft, AlertTriangle, Wallet, Banknote, Building2, ReceiptIndianRupee, Scale, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react';
import TharLoader from '../components/TharLoader';
import Logo from '../components/Logo';
// @ts-ignore
import { useNavigate } from 'react-router-dom';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

const Invoices: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  
  // Workflow State
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select, 2: Profile, 3: Audit/Print
  
  // Data State
  const [sales, setSales] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  
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
      // In the context of a Ledger, we fetch "Uninvoiced" transactions (those not yet committed to a finalized statement)
      const data = await fetchUninvoicedSales();
      setSales(data);
    } catch (e) {
      console.error("Error loading pending entries:", e);
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
      setLedgerHistory(data);
    } catch (e) {
      console.error("Error loading history:", e);
      setLedgerHistory([]);
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

  const selectAll = () => {
      const visibleIds = sales
        .filter(s => s.partNumber.toLowerCase().includes(filter.toLowerCase()) || s.customerName?.toLowerCase().includes(filter.toLowerCase()))
        .map(s => s.id);
      setSelectedIds(new Set(visibleIds));
  };

  const selectedItems = useMemo(() => {
    return sales.filter(s => selectedIds.has(s.id)).map(sale => {
      const stockItem = inventory.find(i => i.partNumber.toLowerCase() === sale.partNumber.toLowerCase());
      return {
        ...sale,
        name: stockItem ? stockItem.name : 'GENUINE AUTO SPARE PART'
      };
    });
  }, [sales, selectedIds, inventory]);

  const stats = useMemo(() => {
    const total = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const paid = selectedItems.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const balance = total - paid;
    return { total, paid, balance };
  }, [selectedItems]);

  const taxRate = shopSettings ? shopSettings.defaultTaxRate : 18;
  const taxableValue = stats.total / (1 + (taxRate/100)); 
  const taxAmount = stats.total - taxableValue;

  const handleConfirmAndPrint = async () => {
    if (!customerDetails.name) return alert("Customer name is mandatory for ledger generation.");
    
    // We use the existing generateTaxInvoiceRecord function to maintain database integrity
    const result = await generateTaxInvoiceRecord(
      Array.from(selectedIds),
      customerDetails,
      { amount: stats.total, tax: taxAmount },
      user.role
    );

    if (result.success && result.invoice) {
      window.print();
      setTimeout(() => {
        alert("Ledger Statement Finalized & Recorded.");
        setStep(1);
        setSelectedIds(new Set());
        setCustomerDetails({ name: '', phone: '', address: '', gst: '', paymentMode: 'CASH' });
        loadPending();
      }, 500);
    } else {
      alert("Validation Error: " + result.message);
    }
  };

  const LedgerPreview = () => (
    <div id="invoice-preview" className="bg-white text-slate-800 p-10 max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:m-0 print:p-8 relative flex flex-col">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
         <div className="flex flex-col gap-4">
            <div className="scale-90 origin-top-left">
                <Logo />
            </div>
            <div className="text-sm space-y-1 text-slate-600 pl-1">
               <p className="font-bold text-slate-900 text-lg">{shopSettings?.name || 'SPAREZY CAR PARTS'}</p>
               <p className="whitespace-pre-line max-w-xs leading-tight">{shopSettings?.address || 'Shop Address Not Configured'}</p>
               <p><span className="font-semibold">Phone:</span> {shopSettings?.phone || 'N/A'}</p>
               <p><span className="font-semibold">GSTIN:</span> {shopSettings?.gst || 'N/A'}</p>
            </div>
         </div>
         <div className="text-right">
            <h1 className="text-3xl font-black text-blue-700 uppercase tracking-tight mb-2">Statement of Account</h1>
            <div className="space-y-1.5 text-sm">
                <p><span className="font-bold text-slate-500 uppercase text-[10px] mr-3">Date Generated:</span> <span className="font-mono font-bold">{new Date().toLocaleDateString()}</span></p>
                <p><span className="font-bold text-slate-500 uppercase text-[10px] mr-3">Total Items:</span> <span className="font-bold">{fd(selectedItems.length)}</span></p>
            </div>
         </div>
      </div>

      <div className="flex justify-between mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
         <div>
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Billed To / Account Holder</h3>
            <p className="font-black text-xl text-slate-900 uppercase tracking-tight">{customerDetails.name}</p>
            {customerDetails.address && <p className="text-sm text-slate-600 mt-1 max-w-sm">{customerDetails.address}</p>}
            <div className="mt-2 space-y-0.5">
                {customerDetails.phone && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-400 text-[10px] uppercase w-12 inline-block">Phone</span> {customerDetails.phone}</p>}
                {customerDetails.gst && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-400 text-[10px] uppercase w-12 inline-block">GSTIN</span> {customerDetails.gst}</p>}
            </div>
         </div>
         <div className="flex flex-col items-end justify-center text-right border-l border-slate-200 pl-8">
             <span className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Amount Payable</span>
             <span className="text-3xl font-black text-rose-600 tracking-tighter">₹{stats.balance.toLocaleString()}</span>
         </div>
      </div>

      <div className="flex-1">
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="bg-slate-900 text-white">
                <th className="py-3 px-4 text-left w-12 font-bold rounded-tl-lg">#</th>
                <th className="py-3 px-4 text-left font-bold uppercase tracking-widest text-[10px]">Item Description</th>
                <th className="py-3 px-4 text-center w-20 font-bold uppercase tracking-widest text-[10px]">Qty</th>
                <th className="py-3 px-4 text-right w-24 font-bold uppercase tracking-widest text-[10px]">Rate</th>
                <th className="py-3 px-4 text-right w-28 font-bold uppercase tracking-widest text-[10px]">Received</th>
                <th className="py-3 px-4 text-right w-32 font-bold rounded-tr-lg uppercase tracking-widest text-[10px]">Line Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-x border-b border-slate-200">
                {selectedItems.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{fd(idx + 1)}</td>
                        <td className="py-3 px-4">
                            <p className="font-black text-slate-900 text-[13px] uppercase leading-tight">{item.name}</p>
                            <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-slate-700">{fd(item.quantity)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 font-medium">₹{item.price.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-teal-600 font-black">₹{(item.paidAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-col md:flex-row justify-between items-end gap-12">
         <div className="w-full md:w-1/2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Balance In Words</p>
            <div className="bg-slate-50 p-4 rounded-xl text-sm font-medium italic text-slate-600 capitalize border border-slate-100 shadow-inner">
                {numberToWords(Math.round(stats.balance))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed uppercase font-black tracking-[0.2em]">
                    Declaration: This statement represents a verified log of parts dispatched and payments recorded. Please settle the net balance within the agreed credit term.
                </p>
            </div>
         </div>

         <div className="w-full md:w-1/3">
            <div className="space-y-3 pb-4 border-b border-slate-200">
                <div className="flex justify-between text-xs font-black text-slate-400 uppercase">
                    <span>Gross Value</span>
                    <span className="text-slate-900">₹{stats.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-teal-600 uppercase">
                    <span>Less Received</span>
                    <span>- ₹{stats.paid.toLocaleString()}</span>
                </div>
            </div>
            <div className="flex justify-between text-xl font-black text-rose-700 mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm">
               <span className="uppercase text-xs tracking-widest">Net Due</span>
               <span className="tracking-tighter">₹{stats.balance.toLocaleString()}</span>
            </div>
            
            <div className="mt-14 text-center">
               <div className="w-24 h-0.5 bg-slate-300 mx-auto mb-2"></div>
               <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.3em]">Authorized Signatory</p>
            </div>
         </div>
      </div>

      <div className="mt-auto pt-8 text-center print:block">
         <div className="border-t border-slate-100 pt-4">
            <p className="text-[9px] text-slate-300 uppercase tracking-[0.4em] font-black flex items-center justify-center gap-2">
               Precision Inventory Statement <span className="text-slate-200">|</span> Generated via Sparezy
            </p>
         </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col relative no-scrollbar">
       <style>{`
         @media print {
           body * { visibility: hidden; }
           #invoice-preview, #invoice-preview * { visibility: visible; }
           #invoice-preview { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; border: none; }
           @page { margin: 8mm; size: auto; }
         }
       `}</style>

       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print bg-white p-4 md:p-0 md:bg-transparent border-b md:border-none border-slate-100">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-elevated">
                <Scale size={24} />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Ledger Sheet Maker</h1>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-60">Reconcile customer accounts and print statements.</p>
             </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft w-full md:w-auto">
             <button 
                onClick={() => { setActiveTab('PENDING'); setStep(1); }}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                <CheckCircle2 size={16} /> Create Sheet
             </button>
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                <History size={16} /> Ledger History
             </button>
          </div>
       </div>

       {pendingApprovalCount > 0 && activeTab === 'PENDING' && (
         <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-5 flex flex-col md:flex-row items-start md:items-center justify-between shadow-soft animate-fade-in no-print gap-4">
            <div className="flex items-center gap-4">
               <div className="bg-white p-2.5 rounded-2xl text-amber-600 shadow-inner border border-amber-100">
                  <AlertTriangle size={22} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Managerial Authorization Required</h3>
                  <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest">{fd(pendingApprovalCount)} sales await owner approval before they can be added to ledger sheets.</p>
               </div>
            </div>
            <button 
               onClick={() => navigate('/approvals')}
               className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-black transition-all w-full md:w-auto active:scale-95 shadow-lg"
            >
               Go to Terminal
            </button>
         </div>
       )}

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'PENDING' && (
             <>
               <div className="bg-white border-b border-slate-100 px-6 md:px-12 py-5 flex items-center justify-center gap-6 no-print shadow-soft z-10">
                  <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${step >= 1 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${step >= 1 ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white border-slate-200 text-slate-400 shadow-sm'}`}>1</span>
                     <span className="hidden md:inline">Select Logs</span>
                  </div>
                  <div className={`w-16 h-0.5 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-100'}`}></div>
                  <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${step >= 2 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${step >= 2 ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white border-slate-200 text-slate-400 shadow-sm'}`}>2</span>
                     <span className="hidden md:inline">Profile</span>
                  </div>
                  <div className={`w-16 h-0.5 rounded-full ${step >= 3 ? 'bg-blue-600' : 'bg-slate-100'}`}></div>
                  <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${step >= 3 ? 'text-blue-600' : 'text-slate-300'}`}>
                     <span className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${step >= 3 ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white border-slate-200 text-slate-400 shadow-sm'}`}>3</span>
                     <span className="hidden md:inline">Dispatch</span>
                  </div>
               </div>

               {step === 1 && (
                 <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 p-4 md:p-10 animate-fade-in no-print">
                    <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 flex flex-col overflow-hidden max-w-6xl mx-auto w-full h-full">
                       <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6">
                          <div className="flex items-center gap-5">
                             <div className="p-3.5 bg-white rounded-2xl shadow-soft border border-slate-100 text-slate-900"><Scale size={20} /></div>
                             <div>
                                <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight">Pending Ledger Entries</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Approved transactions awaiting reconciliation</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4 w-full md:w-auto">
                             <button onClick={selectAll} className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shadow-sm">Select All</button>
                             <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Filter Ledger..." 
                                    className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black uppercase tracking-tight focus:ring-12 focus:ring-blue-500/5 outline-none"
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                />
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex-1 overflow-auto bg-slate-50/30 p-8 no-scrollbar">
                          {sales.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Scale size={80} className="mb-8 opacity-5" />
                                <p className="font-black uppercase tracking-[0.4em] text-[14px]">Reconciliation Queue Empty</p>
                                <p className="text-[10px] mt-2 font-bold uppercase text-slate-300">New approved sales will appear here.</p>
                             </div>
                          ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {sales.filter(s => s.partNumber.toLowerCase().includes(filter.toLowerCase()) || s.customerName?.toLowerCase().includes(filter.toLowerCase())).map(sale => {
                                   const isSelected = selectedIds.has(sale.id);
                                   const partInfo = inventory.find(i => i.partNumber.toLowerCase() === sale.partNumber.toLowerCase());
                                   const balance = (sale.price * sale.quantity) - (sale.paidAmount || 0);
                                   const isFullyPaid = balance <= 0;

                                   return (
                                      <div 
                                        key={sale.id} 
                                        onClick={() => toggleSelect(sale.id)}
                                        className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col gap-6 relative group ${
                                           isSelected 
                                             ? 'border-blue-500 ring-8 ring-blue-500/5 shadow-lg' 
                                             : 'border-slate-100 hover:border-blue-200 shadow-soft'
                                        }`}
                                      >
                                         <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-5">
                                               <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-transparent'}`}>
                                                  <CheckCircle2 size={20} strokeWidth={3} />
                                               </div>
                                               <div>
                                                  <div className="font-black text-slate-900 text-lg leading-none uppercase tracking-tight group-hover:text-blue-600 transition-colors">{partInfo?.name || 'GENUINE SPARE PART'}</div>
                                                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2.5 flex items-center gap-2">
                                                     <Calendar size={12}/> {new Date(sale.createdAt).toLocaleDateString()} <span className="opacity-30">•</span> {sale.partNumber}
                                                  </div>
                                               </div>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-inner ${isFullyPaid ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                               {isFullyPaid ? 'Settled' : 'Payable'}
                                            </div>
                                         </div>
                                         <div className="flex items-end justify-between border-t border-slate-50 pt-6">
                                            <div className="flex items-center gap-3.5">
                                               <div className="p-2.5 bg-slate-50 rounded-2xl text-slate-400"><UserIcon size={16}/></div>
                                               <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight truncate max-w-[150px]">{sale.customerName || 'Standard Client'}</span>
                                            </div>
                                            <div className="text-right">
                                               <div className="font-black text-slate-900 text-xl tracking-tighter tabular-nums">₹{(sale.price * sale.quantity).toLocaleString()}</div>
                                               <div className="text-[9px] text-slate-400 font-black uppercase mt-1">
                                                  {fd(sale.quantity)} PCS @ ₹{sale.price.toLocaleString()}
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          )}
                       </div>

                       <div className="p-10 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center shadow-2xl z-20 gap-8">
                          <div className="flex items-center gap-10 w-full md:w-auto">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5 opacity-60">Aggregate Batch Value</span>
                                <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">₹{stats.total.toLocaleString()}</span>
                             </div>
                             <div className="w-0.5 h-10 bg-slate-100"></div>
                             <div className="flex flex-col">
                                <span className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-1.5">Net Owed Balance</span>
                                <span className="text-3xl font-black text-rose-600 tracking-tighter tabular-nums">₹{stats.balance.toLocaleString()}</span>
                             </div>
                          </div>
                          <button 
                             disabled={selectedIds.size === 0}
                             onClick={() => setStep(2)}
                             className="w-full md:w-auto bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-2xl font-black flex items-center justify-center gap-4 disabled:opacity-30 shadow-2xl transition-all active:scale-95 uppercase text-sm tracking-widest"
                          >
                             Target Customer <ArrowRight size={22} strokeWidth={3} />
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               {step === 2 && (
                  <div className="flex-1 overflow-auto bg-slate-50 p-4 md:p-14 animate-fade-in no-print flex justify-center no-scrollbar">
                     <div className="w-full max-w-2xl space-y-10">
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-200/60 shadow-soft flex justify-between items-center relative overflow-hidden group">
                           <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                           <div className="flex items-center gap-8">
                              <div className="p-5 bg-blue-50 text-blue-600 rounded-[1.75rem] shadow-inner group-hover:scale-105 transition-transform">
                                 <Wallet size={32} strokeWidth={2.5} />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Reconciliation Statement Value</p>
                                 <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{stats.total.toLocaleString()}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200/40">{fd(selectedItems.length)} Logs</span>
                              <button onClick={() => setStep(1)} className="block mt-3 text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">Edit Batch</button>
                           </div>
                        </div>

                        <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200 overflow-hidden">
                           <div className="p-10 border-b border-slate-100 flex items-center gap-6 bg-slate-50/30">
                              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><UserIcon size={28} /></div>
                              <div>
                                 <h3 className="font-black text-slate-900 text-2xl tracking-tight uppercase">Ledger Target Profile</h3>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Dispatching Account Details</p>
                              </div>
                           </div>

                           <div className="p-10 space-y-10">
                              <div className="space-y-8">
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Entity / Station Full Name</label>
                                    <div className="relative group">
                                       <UserIcon size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                       <input 
                                          autoFocus
                                          type="text" 
                                          className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none transition-all font-black uppercase text-[17px] shadow-inner-soft placeholder:text-slate-200"
                                          placeholder="e.g. SKYLINE AUTO SERVICES"
                                          value={customerDetails.name}
                                          onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})}
                                       />
                                    </div>
                                 </div>

                                 <div className="grid grid-cols-2 gap-8">
                                    <div>
                                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Contact Reference</label>
                                       <div className="relative group">
                                          <Phone size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" />
                                          <input 
                                             type="text" 
                                             className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none transition-all font-bold text-sm shadow-inner-soft"
                                             placeholder="Mobile/WhatsApp"
                                             value={customerDetails.phone}
                                             onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}
                                          />
                                       </div>
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">GSTIN Identifier</label>
                                       <div className="relative group">
                                          <Building2 size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" />
                                          <input 
                                             type="text" 
                                             className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none transition-all font-black text-sm shadow-inner-soft uppercase"
                                             placeholder="Optional Tax ID"
                                             value={customerDetails.gst}
                                             onChange={e => setCustomerDetails({...customerDetails, gst: e.target.value})}
                                          />
                                       </div>
                                    </div>
                                 </div>

                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Billing Station Address</label>
                                    <div className="relative group">
                                       <MapPin size={20} className="absolute left-5 top-6 text-slate-300 group-focus-within:text-blue-500" />
                                       <textarea 
                                          className="w-full pl-14 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:ring-12 focus:ring-blue-500/5 focus:border-blue-500/10 focus:bg-white outline-none transition-all resize-none font-bold text-sm shadow-inner-soft uppercase"
                                          rows={3}
                                          placeholder="Primary Dispatch Address"
                                          value={customerDetails.address}
                                          onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="pt-10 border-t border-slate-50">
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 ml-1">Account Settlement Protocol</label>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                    {[
                                       { mode: 'CASH', icon: Banknote }, 
                                       { mode: 'UPI', icon: Wallet }, 
                                       { mode: 'CARD', icon: CreditCard }, 
                                       { mode: 'CREDIT', icon: FileText }
                                    ].map(item => (
                                       <button
                                          key={item.mode}
                                          onClick={() => setCustomerDetails({...customerDetails, paymentMode: item.mode})}
                                          className={`flex flex-col items-center justify-center gap-4 py-6 rounded-[2rem] border-2 transition-all active:scale-95 ${
                                             customerDetails.paymentMode === item.mode 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xl ring-8 ring-blue-500/5' 
                                                : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                          }`}
                                       >
                                          <item.icon size={26} strokeWidth={2.5} />
                                          <span className="text-[11px] font-black uppercase tracking-widest">{item.mode}</span>
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>

                           <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                              <button onClick={() => setStep(1)} className="text-slate-400 font-black hover:text-slate-900 flex items-center gap-3 transition-all uppercase text-[11px] tracking-widest px-6">
                                 <ChevronLeft size={22} strokeWidth={3} /> Revise Selection
                              </button>
                              <button 
                                 disabled={!customerDetails.name}
                                 onClick={() => setStep(3)}
                                 className="bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-2xl font-black flex items-center gap-4 disabled:opacity-30 transition-all shadow-2xl active:scale-95 uppercase text-sm tracking-widest"
                              >
                                 Preview Document <ArrowRight size={22} strokeWidth={3} />
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {step === 3 && (
                  <div className="flex-1 flex flex-col md:flex-row bg-slate-100 overflow-hidden no-scrollbar">
                     <div className="flex-1 overflow-auto p-4 md:p-12 flex justify-center no-scrollbar">
                        <LedgerPreview />
                     </div>
                     <div className="w-full md:w-[380px] bg-white border-l border-slate-200 p-10 flex flex-col gap-10 shadow-2xl z-20 no-print">
                        <div>
                           <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl w-fit mb-8 shadow-inner"><Scale size={32} strokeWidth={2.5}/></div>
                           <h3 className="font-black text-slate-900 text-3xl tracking-tight leading-none mb-4 uppercase">Document Finalized</h3>
                           <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wide opacity-80">This statement has been synchronized with the financial ledger and is ready for dispatch.</p>
                        </div>
                        
                        <div className="space-y-6">
                           <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/5 rounded-full -mr-10 -mt-10"></div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Realized Outstanding Due</p>
                               <div className="flex justify-between items-end relative z-10">
                                  <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{stats.balance.toLocaleString()}</span>
                                  <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 uppercase tracking-widest mb-1.5">Net Owed</span>
                               </div>
                           </div>

                           <button 
                              onClick={handleConfirmAndPrint}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-5 active:scale-95 uppercase text-base tracking-widest"
                           >
                              <Printer size={26} strokeWidth={2.5} /> Commit & Dispatch
                           </button>
                           <button 
                              onClick={() => setStep(2)}
                              className="w-full bg-white border-2 border-slate-200 text-slate-600 py-6 rounded-3xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-4 uppercase text-sm tracking-widest"
                           >
                              Edit Account Details
                           </button>
                        </div>
                        
                        <div className="mt-auto pt-10 border-t border-slate-100 flex items-start gap-5">
                           <div className="p-2.5 bg-slate-50 rounded-2xl text-slate-400"><AlertCircle size={22} /></div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed tracking-wider">Crucial Note: Dispatching this statement will mark the selected transactions as 'Statement Sent' in the auditing trail.</p>
                        </div>
                     </div>
                  </div>
               )}
             </>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 h-full flex flex-col overflow-hidden m-6 no-print animate-fade-in">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                    <span className="font-black text-slate-900 flex items-center gap-4 uppercase text-base tracking-tight">
                       <History size={22} className="text-blue-600" /> Dispatch History Ledger
                    </span>
                    <button onClick={loadHistory} className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100 shadow-sm active:scale-90">
                        <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto no-scrollbar">
                   {ledgerHistory.length === 0 ? (
                     <div className="p-40 text-center text-slate-200">
                        <FileText size={100} className="mx-auto mb-10 opacity-5" />
                        <p className="font-black uppercase tracking-[0.5em] text-[15px]">No statement logs found</p>
                     </div>
                   ) : (
                      <table className="w-full text-sm text-left border-collapse">
                         <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-[0.25em] border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                               <th className="px-10 py-6">Statement Sequence</th>
                               <th className="px-10 py-6">Timestamp</th>
                               <th className="px-10 py-6">Account Holder</th>
                               <th className="px-10 py-6 text-center">Batch Size</th>
                               <th className="px-10 py-6 text-right">Settlement Value</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {ledgerHistory.map(inv => (
                               <tr key={inv.id} className="hover:bg-slate-50/80 transition-all group cursor-default">
                                  <td className="px-10 py-6 font-black text-slate-900 uppercase group-hover:text-blue-600 transition-colors tracking-tight text-base">{inv.invoiceNumber}</td>
                                  <td className="px-10 py-6 text-slate-500 font-black uppercase text-[11px] tracking-widest">{new Date(inv.date).toLocaleDateString()}</td>
                                  <td className="px-10 py-6">
                                     <div className="font-black text-slate-900 uppercase tracking-tight truncate max-w-[280px] text-[15px]">{inv.customerName}</div>
                                  </td>
                                  <td className="px-10 py-6 text-center">
                                     <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200/40">{fd(inv.itemsCount)} Transactions</span>
                                  </td>
                                  <td className="px-10 py-6 text-right font-black text-slate-900 text-xl tracking-tighter tabular-nums">₹{inv.totalAmount.toLocaleString()}</td>
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
