
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, ShopSettings, TransactionStatus, TransactionType } from '../types';
import { fetchUninvoicedSales, generateTaxInvoiceRecord, fetchInvoices } from '../services/transactionService';
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
  Check
} from 'lucide-react';
import TharLoader from '../components/TharLoader';
import Logo from '../components/Logo';

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

  useEffect(() => { fetchInventory().then(setInventory); getShopSettings().then(setShopSettings); }, []);
  useEffect(() => { if (activeTab === 'PENDING') loadPending(); else loadHistory(); }, [activeTab]);

  const loadPending = async () => { setLoading(true); try { const data = await fetchUninvoicedSales(); setSales(data); } catch (e) { setSales([]); } finally { setLoading(false); } };
  const loadHistory = async () => { setLoading(true); try { const data = await fetchInvoices(); setLedgerHistory(data); } catch (e) { setLedgerHistory([]); } finally { setLoading(false); } };
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
    <div className="space-y-8 h-full flex flex-col relative pb-32 animate-fade-in">
       <style>{`@media print { body * { visibility: hidden; } #ledger-print, #ledger-print * { visibility: visible; } #ledger-print { position: absolute; left: 0; top: 0; width: 100%; border: none; } }`}</style>
       
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print px-2">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-slate-950 rounded-[2rem] flex items-center justify-center text-white shadow-elevated"><Scale size={32} strokeWidth={3} /></div>
             <div><h1 className="text-3xl font-black text-slate-950 tracking-tighter uppercase leading-none mb-2">Ledger Engine</h1><p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-[0.3em]">Account Reconciliation Tool</p></div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border-2 border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('PENDING')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'PENDING' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>Selection Matrix</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>Archived Logs</button>
          </div>
       </div>

       {activeTab === 'PENDING' && (
          <div className="flex-1 flex flex-col bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 overflow-hidden no-print">
              <div className="px-8 py-6 border-b-2 border-slate-100 bg-slate-50 flex items-center justify-center gap-8">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all ${step >= s ? 'text-slate-950' : 'text-slate-400'}`}>
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${step >= s ? 'bg-slate-950 text-white border-slate-950 shadow-lg' : 'bg-white border-slate-200 shadow-inner'}`}>{s}</span>
                      <span>{s === 1 ? 'Select Logs' : s === 2 ? 'Audit Profile' : 'Final Dispatch'}</span>
                    </div>
                  ))}
              </div>

              {step === 1 && (
                  <div className="flex-1 overflow-auto p-10 bg-slate-50/20 no-scrollbar">
                      {loading ? <TharLoader /> : sales.length === 0 ? <div className="py-40 text-center text-slate-300 font-black uppercase tracking-[0.4em]">Selection Queue Clear</div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                            {sales.map(sale => (
                                <div key={sale.id} onClick={() => toggleSelect(sale.id)} className={`p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer bg-white relative group ${selectedIds.has(sale.id) ? 'border-blue-700 ring-8 ring-blue-50 shadow-elevated' : 'border-slate-200 hover:border-slate-400 shadow-soft'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${selectedIds.has(sale.id) ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'}`}><Check size={20} strokeWidth={4}/></div>
                                            <div className="space-y-1"><h3 className="font-black text-slate-950 text-xl tracking-tighter uppercase leading-none">{sale.partNumber}</h3><p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{new Date(sale.createdAt).toLocaleDateString()}</p></div>
                                        </div>
                                        <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Value</p><p className="text-2xl font-black text-slate-950 tracking-tighter tabular-nums">₹{(sale.price * sale.quantity).toLocaleString()}</p></div>
                                    </div>
                                    <div className="pt-6 border-t-2 border-slate-50 flex items-center gap-3"><UserIcon size={16} className="text-slate-400" /><span className="text-[12px] font-extrabold text-slate-700 uppercase tracking-tight truncate">{sale.customerName || 'Standard Client'}</span></div>
                                </div>
                            ))}
                        </div>
                      )}
                  </div>
              )}

              {step === 2 && (
                  <div className="flex-1 overflow-auto p-12 flex flex-col items-center justify-center bg-slate-100 no-scrollbar">
                      <div className="w-full max-w-xl bg-white rounded-[3rem] border-2 border-slate-200 shadow-elevated overflow-hidden">
                          <div className="p-10 bg-slate-950 text-white flex items-center gap-6"><div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner"><UserIcon size={32} strokeWidth={3} /></div><div><h3 className="text-2xl font-black uppercase tracking-tighter">Target Profile</h3><p className="text-[11px] font-extrabold text-white/50 uppercase tracking-widest">Verify Dispatch Account</p></div></div>
                          <div className="p-12 space-y-10">
                              <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Entity Station Name</label><input type="text" className="w-full p-6 bg-slate-100 border-2 border-transparent rounded-2xl text-2xl font-black text-slate-950 outline-none focus:border-slate-950 transition-all uppercase tracking-tight" placeholder="e.g. SKYLINE MOTORS" value={customerDetails.name} onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})}/></div>
                              <div className="grid grid-cols-2 gap-8">
                                  <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Contact Phone</label><input type="text" className="w-full p-6 bg-slate-100 border-2 border-transparent rounded-2xl font-bold text-slate-950 outline-none focus:border-slate-950" value={customerDetails.phone} onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})}/></div>
                                  <div><label className="block text-[11px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4">GSTIN ID</label><input type="text" className="w-full p-6 bg-slate-100 border-2 border-transparent rounded-2xl font-black text-slate-950 uppercase outline-none focus:border-slate-950" value={customerDetails.gst} onChange={e => setCustomerDetails({...customerDetails, gst: e.target.value})}/></div>
                              </div>
                          </div>
                          <div className="p-10 border-t-2 border-slate-100 bg-slate-50 flex gap-4"><button onClick={() => setStep(1)} className="flex-1 py-5 rounded-2xl font-black text-slate-600 uppercase text-xs tracking-widest border-2 border-slate-200">Go Back</button><button onClick={() => setStep(3)} disabled={!customerDetails.name} className="flex-[2] py-5 bg-slate-950 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-xl disabled:opacity-30">Verify Matrix <ArrowRight size={18} className="inline ml-2" strokeWidth={3} /></button></div>
                      </div>
                  </div>
              )}

              {step === 1 && (
                  <div className="p-10 border-t-2 border-slate-100 flex justify-between items-center shadow-2xl z-20 bg-slate-50"><div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Cycle Reconciliation Value</span><p className="text-4xl font-black text-slate-950 tracking-tighter tabular-nums">₹{stats.total.toLocaleString()}</p></div><button disabled={selectedIds.size === 0} onClick={() => setStep(2)} className="bg-slate-950 text-white px-12 py-6 rounded-2xl font-black shadow-2xl active:scale-95 transition-all uppercase text-[15px] tracking-widest disabled:opacity-30">Initialize Profile <ArrowRight size={22} className="inline ml-4" strokeWidth={4} /></button></div>
              )}
          </div>
       )}

       {activeTab === 'HISTORY' && (
          <div className="bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 flex flex-col overflow-hidden m-2"><div className="p-10 border-b-2 border-slate-100 bg-slate-50 flex justify-between items-center"><h2 className="font-black text-slate-950 text-xl tracking-tighter uppercase">Archived Ledger Logs</h2><button onClick={loadHistory} className="p-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-500 hover:text-blue-700 transition-all"><RefreshCw size={24} strokeWidth={3}/></button></div><div className="flex-1 overflow-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-100 text-slate-900 border-b-2 border-slate-200"><tr><th className="px-10 py-6 font-black uppercase text-[11px] tracking-[0.2em]">Statement ID</th><th className="px-10 py-6 font-black uppercase text-[11px] tracking-[0.2em]">Timestamp</th><th className="px-10 py-6 font-black uppercase text-[11px] tracking-[0.2em]">Entity Station</th><th className="px-10 py-6 font-black uppercase text-[11px] tracking-[0.2em] text-right">Settlement Value</th></tr></thead><tbody className="divide-y-2 divide-slate-50">{ledgerHistory.map(inv => (<tr key={inv.id} className="hover:bg-slate-50 transition-colors"><td className="px-10 py-6 font-black text-slate-950 text-base">{inv.invoiceNumber}</td><td className="px-10 py-6 text-slate-700 font-bold">{new Date(inv.date).toLocaleDateString()}</td><td className="px-10 py-6 font-black text-slate-950 uppercase">{inv.customerName}</td><td className="px-10 py-6 text-right font-black text-slate-950 text-xl tabular-nums">₹{inv.totalAmount.toLocaleString()}</td></tr>))}</tbody></table></div></div>
       )}
    </div>
  );
};

export default Invoices;
