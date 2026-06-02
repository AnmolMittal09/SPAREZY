
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, ShopSettings, TransactionStatus, TransactionType } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices, deleteInvoice } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { getShopSettings } from '../services/masterService';
import { numberToWords } from '../services/invoiceService'; 
import { 
  FileText, 
  Printer, 
  Search, 
  RefreshCw, 
  History, 
  ArrowRight, 
  User as UserIcon, 
  ChevronLeft, 
  Scale, 
  Calendar,
  Check,
  Trash2
} from 'lucide-react';
import TharLoader from '../components/TharLoader';
import Logo from '../components/Logo';
import ConfirmModal from '../components/ConfirmModal';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const Invoices: React.FC<any> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const [customerDetails, setCustomerDetails] = useState({ name: '', phone: '', address: '', gst: '', paymentMode: 'CASH' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);

  useEffect(() => { fetchInventory().then(setInventory); getShopSettings().then(setShopSettings); }, []);
  useEffect(() => { if (activeTab === 'PENDING') loadPending(); else loadHistory(); }, [activeTab]);

  const loadPending = async () => { setLoading(true); try { const data = await fetchUninvoicedSales(); setSales(data); } catch (e) { setSales([]); } finally { setLoading(false); } };
  const loadHistory = async () => { setLoading(true); try { const data = await fetchInvoices(); setLedgerHistory(data); } catch (e) { setLedgerHistory([]); } finally { setLoading(false); } };
  
  const handleTriggerDeleteInvoice = (inv: any) => {
    setInvoiceToDelete(inv);
    setShowDeleteConfirm(true);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeletingInvoice(true);
    try {
      const res = await deleteInvoice(invoiceToDelete.id);
      if (res.success) {
        setShowDeleteConfirm(false);
        setInvoiceToDelete(null);
        loadHistory();
      } else {
        alert(res.message || "Failed to delete invoice");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setDeletingInvoice(false);
    }
  };

  const toggleSelect = (id: string) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };

  const selectedItems = useMemo(() => sales.filter(s => selectedIds.has(s.id)).map(sale => ({
      ...sale, name: inventory.find(i => i.partNumber.toLowerCase() === sale.partNumber.toLowerCase())?.name || 'GENUINE SPARE PART'
  })), [sales, selectedIds, inventory]);

  const stats = useMemo(() => {
    const total = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const paid = selectedItems.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    return { total, paid, balance: total - paid };
  }, [selectedItems]);

  const handleConfirmAndPrint = async () => {
    if (!customerDetails.name) return alert("Account holder name is required.");
    const result = await generateTaxInvoiceRecord(Array.from(selectedIds), customerDetails, { amount: stats.total, tax: 0 }, user.role);
    if (result.success) { window.print(); setStep(1); setSelectedIds(new Set()); loadPending(); }
  };

  return (
    <div className="space-y-6 sm:space-y-8 h-full flex flex-col relative pb-32 animate-fade-in">
       <style>{`@media print { body * { visibility: hidden; } #ledger-print, #ledger-print * { visibility: visible; } #ledger-print { position: absolute; left: 0; top: 0; width: 100%; border: none; } }`}</style>
       
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print px-2 pb-2">
          <div className="flex items-center gap-4 sm:gap-5">
             <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-950 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-white shadow-elevated flex-shrink-0">
                <Scale className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={3} />
             </div>
             <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tighter uppercase leading-none mb-1 sm:mb-2">Ledger Engine</h1>
                <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-wider sm:tracking-[0.3em]">Account Reconciliation Tool</p>
             </div>
          </div>
          <div className="flex bg-white p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-250 sm:border-2 sm:border-slate-200 shadow-soft w-full md:w-auto">
             <button onClick={() => { setActiveTab('PENDING'); setStep(1); }} className={`flex-1 md:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>Selection Matrix</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 md:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>Archived Logs</button>
          </div>
       </div>

       {activeTab === 'PENDING' && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl sm:rounded-[3rem] shadow-premium border border-slate-200 overflow-hidden no-print">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-102 bg-slate-50 flex items-center justify-center gap-3 sm:gap-8">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wide sm:tracking-widest transition-all ${step >= s ? 'text-slate-950' : 'text-slate-400'}`}>
                      <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border sm:border-2 text-xs sm:text-sm font-black ${step >= s ? 'bg-slate-950 text-white border-slate-950 shadow-md' : 'bg-white border-slate-200 shadow-inner'}`}>{s}</span>
                      <span className="hidden xs:inline sm:inline">{s === 1 ? 'Select' : s === 2 ? 'Audit' : 'Verify'}</span>
                      <span className="hidden md:inline">{s === 1 ? ' Logs' : s === 2 ? ' Profile' : ' Dispatch'}</span>
                    </div>
                  ))}
              </div>

              {step === 1 && (
                  <div className="flex-1 overflow-auto p-4 sm:p-10 bg-slate-50/20 no-scrollbar">
                      {loading ? <TharLoader /> : sales.length === 0 ? <div className="py-20 sm:py-40 text-center text-slate-350 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-xs sm:text-sm">Selection Queue Clear</div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto">
                            {sales.map(sale => (
                                <div key={sale.id} onClick={() => toggleSelect(sale.id)} className={`p-5 sm:p-8 rounded-xl sm:rounded-[2rem] border border-slate-200 sm:border-2 transition-all cursor-pointer bg-white relative group ${selectedIds.has(sale.id) ? 'border-blue-700 ring-4 sm:ring-8 ring-blue-50 shadow-elevated' : 'hover:border-slate-400 shadow-soft'}`}>
                                    <div className="flex justify-between items-start mb-4 sm:mb-6">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border sm:border-2 flex items-center justify-center transition-all ${selectedIds.has(sale.id) ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'}`}><Check className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={4}/></div>
                                            <div className="space-y-0.5 sm:space-y-1">
                                               <h3 className="font-black text-slate-950 text-base sm:text-xl tracking-tighter uppercase leading-none">{sale.partNumber}</h3>
                                               <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{new Date(sale.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                           <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Total Value</p>
                                           <p className="text-lg sm:text-2xl font-black text-slate-950 tracking-tighter tabular-nums">₹{(sale.price * sale.quantity).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="pt-4 sm:pt-6 border-t border-slate-103 sm:border-t-2 sm:border-slate-50 flex items-center gap-2 sm:gap-3">
                                       <UserIcon size={14} className="text-slate-400" />
                                       <span className="text-[11px] sm:text-[12px] font-extrabold text-slate-700 uppercase tracking-tight truncate">{sale.customerName || 'Standard Client'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                      )}
                  </div>
              )}

              {step === 2 && (
                  <div className="flex-1 overflow-auto p-4 sm:p-12 flex flex-col items-center justify-center bg-slate-100 no-scrollbar">
                      <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-[3rem] border border-slate-200 sm:border-2 shadow-elevated overflow-hidden">
                          <div className="p-6 sm:p-10 bg-slate-950 text-white flex items-center gap-4 sm:gap-6">
                             <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner flex-shrink-0">
                                <UserIcon className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={3} />
                             </div>
                             <div>
                                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Target Profile</h3>
                                <p className="text-[10px] sm:text-[11px] font-extrabold text-white/50 uppercase tracking-widest">Verify Dispatch Account</p>
                             </div>
                          </div>
                          <div className="p-6 sm:p-12 space-y-6 sm:space-y-10">
                              <div>
                                 <label className="block text-[9px] sm:text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-2 sm:mb-4">Entity Station Name</label>
                                 <input type="text" className="w-full p-4 sm:p-6 bg-slate-100 border border-transparent rounded-xl sm:rounded-2xl text-base sm:text-2xl font-black text-slate-950 outline-none focus:bg-white focus:border-slate-950 transition-all uppercase tracking-tight" placeholder="e.g. SKYLINE MOTORS" value={customerDetails.name} onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})}/>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                  <div>
                                     <label className="block text-[9px] sm:text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-2 sm:mb-4">Contact Phone</label>
                                     <input type="text" className="w-full p-4 sm:p-6 bg-slate-100 border border-transparent rounded-xl sm:rounded-2xl font-bold text-slate-950 outline-none focus:bg-white focus:border-slate-950" placeholder="e.g. +91 99999..." value={customerDetails.phone} onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}/>
                                  </div>
                                  <div>
                                     <label className="block text-[9px] sm:text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-2 sm:mb-4">GSTIN ID</label>
                                     <input type="text" className="w-full p-4 sm:p-6 bg-slate-100 border border-transparent rounded-xl sm:rounded-2xl font-black text-slate-950 uppercase outline-none focus:bg-white focus:border-slate-950" placeholder="e.g. 07AAAAA..." value={customerDetails.gst} onChange={e => setCustomerDetails({...customerDetails, gst: e.target.value})}/>
                                  </div>
                              </div>
                          </div>
                          <div className="p-6 sm:p-10 border-t border-slate-100 sm:border-t-2 sm:bg-slate-50 flex gap-3 sm:gap-4">
                             <button onClick={() => setStep(1)} className="flex-1 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-slate-600 uppercase text-[10px] sm:text-xs tracking-wider sm:tracking-widest border border-slate-205 sm:border-2 bg-white sm:bg-transparent">Go Back</button>
                             <button onClick={() => setStep(3)} disabled={!customerDetails.name} className="flex-[2] py-4 sm:py-5 bg-slate-950 text-white font-black rounded-xl sm:rounded-2xl uppercase text-[10px] sm:text-xs tracking-wider sm:tracking-widest shadow-xl disabled:opacity-30">Verify Matrix <ArrowRight size={16} className="inline ml-1 sm:ml-2" strokeWidth={3} /></button>
                          </div>
                      </div>
                  </div>
              )}

              {step === 3 && (
                  <div className="flex-1 overflow-auto p-4 sm:p-12 flex flex-col items-center justify-center bg-slate-100 no-scrollbar">
                      <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-[3rem] border border-slate-200 sm:border-2 shadow-elevated overflow-hidden">
                          <div className="p-6 sm:p-10 bg-slate-950 text-white flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shadow-inner text-teal-400 flex-shrink-0"><Printer size={24} strokeWidth={3} /></div>
                                <div className="text-left"><h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Final Dispatch</h3><p className="text-[10px] font-extrabold text-white/50 uppercase tracking-widest">Ready for Ledger Settlement</p></div>
                             </div>
                             <span className="bg-teal-600 text-white font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest">Awaiting Print</span>
                          </div>

                          <div className="p-6 sm:p-12 space-y-6 sm:space-y-8 text-left">
                              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
                                  <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Reconciliation Customer Summary</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-bold">
                                      <div className="space-y-1"><p className="text-slate-455 text-slate-500 text-xs">Customer/Station</p><p className="text-slate-900 uppercase font-black">{customerDetails.name}</p></div>
                                      <div className="space-y-1"><p className="text-slate-455 text-slate-500 text-xs">Contact Phone</p><p className="text-slate-900">{customerDetails.phone || 'N/A'}</p></div>
                                      <div className="space-y-1"><p className="text-slate-455 text-slate-500 text-xs">GSTIN ID</p><p className="text-slate-900 uppercase">{customerDetails.gst || 'N/A'}</p></div>
                                      <div className="space-y-1"><p className="text-slate-455 text-slate-500 text-xs">Ledger Total</p><p className="text-slate-900 font-extrabold">₹{stats.total.toLocaleString()}</p></div>
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Inbound Logs ({selectedItems.length})</h4>
                                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-3 bg-white no-scrollbar">
                                      {selectedItems.map((item, idx) => (
                                          <div key={idx} className="py-3 flex justify-between items-center text-xs font-bold gap-4">
                                              <div className="flex flex-col min-w-0"><span className="text-slate-900 uppercase truncate">{item.partNumber}</span><span className="text-[10.5px] text-slate-400 truncate max-w-[200px]">{item.name}</span></div>
                                              <div className="text-right flex-shrink-0"><span className="text-slate-900">{item.quantity} PCS</span><p className="text-[10px] text-slate-500">₹{(item.price * item.quantity).toLocaleString()}</p></div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          <div className="p-6 sm:p-10 border-t border-slate-100 bg-slate-50 flex gap-3 sm:gap-4">
                             <button onClick={() => setStep(2)} className="flex-1 py-4 sm:py-5 bg-white rounded-xl sm:rounded-2xl font-black text-slate-600 uppercase text-[10px] sm:text-xs tracking-wider sm:tracking-widest border border-slate-200">Modify Profile</button>
                             <button onClick={handleConfirmAndPrint} className="flex-[2] py-4 sm:py-5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl sm:rounded-2xl uppercase text-[10px] sm:text-xs tracking-wider sm:tracking-widest shadow-xl flex items-center justify-center gap-1.5 sm:gap-2">
                                 <Printer size={16} strokeWidth={3} /> Print & Finalize Ledger
                             </button>
                          </div>
                      </div>
                  </div>
              )}

              {step === 1 && (
                  <div className="p-5 sm:p-10 border-t border-slate-101 sm:border-t-2 bg-slate-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shadow-2xl z-20">
                     <div className="flex flex-col text-left">
                        <span className="text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1">Cycle Reconciliation Value</span>
                        <p className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tighter leading-none tabular-nums text-left">₹{stats.total.toLocaleString()}</p>
                     </div>
                     <button 
                        disabled={selectedIds.size === 0} 
                        onClick={() => setStep(2)} 
                        className="bg-slate-950 text-white px-6 sm:px-12 py-4 sm:py-6 rounded-xl sm:rounded-2xl font-black shadow-2xl active:scale-95 transition-all uppercase text-xs sm:text-[15px] tracking-wider sm:tracking-widest disabled:opacity-30 flex items-center justify-center gap-2 sm:gap-4"
                     >
                        <span>Initialize Profile</span>
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={4} />
                     </button>
                  </div>
              )}
          </div>
       )}

       {activeTab === 'HISTORY' && (
          <div className="bg-white rounded-2xl sm:rounded-[3rem] shadow-premium border border-slate-200 flex flex-col overflow-hidden">
             <div className="p-5 sm:p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-black text-slate-950 text-base sm:text-xl tracking-tighter uppercase">Archived Ledger Logs</h2>
                <button onClick={loadHistory} className="p-2 sm:p-3 bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-slate-500 hover:text-blue-700 transition-all"><RefreshCw className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={3}/></button>
             </div>
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-900 border-b border-slate-200">
                      <tr>
                         <th className="px-4 sm:px-10 py-4 sm:py-6 font-black uppercase text-[10px] sm:text-[11px] tracking-wider sm:tracking-[0.2em]">Statement ID</th>
                         <th className="px-4 sm:px-10 py-4 sm:py-6 font-black uppercase text-[10px] sm:text-[11px] tracking-wider sm:tracking-[0.2em] hidden sm:table-cell">Timestamp</th>
                         <th className="px-4 sm:px-10 py-4 sm:py-6 font-black uppercase text-[10px] sm:text-[11px] tracking-wider sm:tracking-[0.2em]">Entity Station</th>
                         <th className="px-4 sm:px-10 py-4 sm:py-6 font-black uppercase text-[10px] sm:text-[11px] tracking-wider sm:tracking-[0.2em] text-right">Settlement Value</th>
                         <th className="px-4 sm:px-10 py-4 sm:py-6 font-black uppercase text-[10px] sm:text-[11px] tracking-wider sm:tracking-[0.2em] text-center">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {ledgerHistory.map(inv => (
                         <tr key={inv.id} className="hover:bg-slate-50 transition-colors text-xs sm:text-sm">
                            <td className="px-4 sm:px-10 py-4 sm:py-6 font-black text-slate-950">{inv.invoiceNumber}</td>
                            <td className="px-4 sm:px-10 py-4 sm:py-6 text-slate-700 font-bold hidden sm:table-cell">{new Date(inv.date).toLocaleDateString()}</td>
                            <td className="px-4 sm:px-10 py-4 sm:py-6 font-black text-slate-950 uppercase">{inv.customerName}</td>
                            <td className="px-4 sm:px-10 py-4 sm:py-6 text-right font-black text-slate-950 text-sm sm:text-xl tabular-nums">₹{inv.totalAmount.toLocaleString()}</td>
                            <td className="px-4 sm:px-10 py-4 sm:py-6 text-center">
                               <button 
                                  onClick={() => handleTriggerDeleteInvoice(inv)} 
                                  className="p-2 sm:p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg sm:rounded-xl transition-all"
                                  title="Delete Invoice"
                               >
                                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       )}

       <ConfirmModal
         isOpen={showDeleteConfirm}
         onClose={() => { setShowDeleteConfirm(false); setInvoiceToDelete(null); }}
         onConfirm={handleDeleteInvoice}
         title="Delete Invoice Record?"
         message={`Are you sure you want to delete invoice ${invoiceToDelete ? invoiceToDelete.invoiceNumber : ''}? This will detach and unlink the transaction logs. This change cannot be undone.`}
         confirmLabel="Delete Invoice"
         cancelLabel="Hold Record"
         variant="danger"
         loading={deletingInvoice}
       />
    </div>
  );
};

export default Invoices;
