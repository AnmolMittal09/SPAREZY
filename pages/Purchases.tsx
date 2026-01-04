
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Brand } from '../types';
import DailyTransactions from './DailyTransactions';
import { 
  History, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ScanLine,
  ChevronRight,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Package,
  Layers,
  List,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Truck,
  Database,
  Calendar,
  Clock,
  ArrowUpDown,
  Upload
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import TharLoader from '../components/TharLoader';
import * as XLSX from 'xlsx';

interface ExtractedItem {
  partNumber: string;
  name: string;
  quantity: number;
  mrp: number;
  discountPercent: number;
  printedUnitPrice: number;
  calculatedPrice: number;
  hasError: boolean;
  errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE';
  diff: number;
}

interface GroupedInbound {
  id: string;
  createdAt: string;
  customerName: string; 
  items: Transaction[];
  totalValue: number;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
}

const Purchases: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'IMPORT' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<'STACKED' | 'LIST'>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<{ dealerName?: string; invoiceDate?: string }>({});
  const [importLog, setImportLog] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);

  const loadHistory = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.PURCHASE);
      const inv = await fetchInventory();
      setHistory(data);
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') loadHistory();
  }, [activeTab]);

  const startAiAudit = async () => {
    if (queuedFiles.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
        const payload: InvoiceFile[] = [];
        for (const q of queuedFiles) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
             reader.readAsDataURL(q.file);
             reader.onload = () => resolve((reader.result as string).split(',')[1]);
          });
          payload.push({ data: base64, mimeType: q.file.type });
        }
        const result = await extractInvoiceData(payload);
        if (result && result.items) {
          setExtractedMetadata({ dealerName: result.dealerName, invoiceDate: result.invoiceDate });
          setPreviewData(result.items.map((i: any) => {
             const expected = i.mrp * 0.88;
             const isLow = i.discountPercent < 12;
             return { ...i, calculatedPrice: expected, hasError: isLow, errorType: isLow ? 'DISCOUNT_LOW' : 'NONE' };
          }));
        }
    } catch (e: any) {
        setErrorMsg(e.message || "Audit failed.");
    } finally {
        setImporting(false);
    }
  };

  const confirmSync = async () => {
    setImporting(true);
    try {
       const inventoryPayload = previewData.map(item => {
          const existing = inventory.find(i => i.partNumber.toUpperCase() === item.partNumber.toUpperCase());
          return {
             partNumber: item.partNumber,
             name: item.name,
             price: item.mrp,
             quantity: (existing?.quantity || 0) + item.quantity
          };
       });
       await updateOrAddItems(inventoryPayload);
       await createBulkTransactions(previewData.map(i => ({
          partNumber: i.partNumber,
          type: TransactionType.PURCHASE,
          quantity: i.quantity,
          price: i.printedUnitPrice,
          customerName: extractedMetadata.dealerName || 'Dealer',
          createdByRole: user.role
       })));
       setImportLog({ success: true, count: previewData.length });
       setPreviewData([]);
    } catch (e: any) {
       setErrorMsg(e.message);
    } finally {
       setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       {/* MOBILE TAB NAV & REFRESH */}
       <div className="md:hidden bg-white p-3 border-b border-slate-100 flex items-center justify-between shadow-sm sticky top-0 z-[100]">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 mr-4">
             <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Entry</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Scan</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Log</button>
          </div>
          <button onClick={() => loadHistory(true)} className="p-2 text-slate-400"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
       </div>

       <div className="hidden md:flex justify-between items-center mb-8 px-1 pt-4">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Purchasing</h1>
             <p className="text-slate-500 font-medium">Verify stock acquisitions with automated AI auditing.</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Manual Entry</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>AI Document Scan</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>History Log</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" />}

          {activeTab === 'IMPORT' && (
             <div className="h-full flex flex-col p-4 space-y-4 max-w-4xl mx-auto overflow-y-auto no-scrollbar pb-32">
                {!previewData.length && !importLog && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
                       <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Calculator size={24}/></div>
                       <div>
                          <h4 className="font-black text-blue-900 text-sm uppercase tracking-tight">12% B.DC Audit Engine</h4>
                          <p className="text-[12px] text-blue-700/80 mt-1 font-medium">Scan bills to detect under-discounting from dealers.</p>
                       </div>
                    </div>

                    {queuedFiles.length > 0 ? (
                       <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-soft">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Document Queue</h5>
                          <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar">
                             {queuedFiles.map(q => (
                                <div key={q.id} className="w-24 h-32 flex-none relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                                   <img src={q.preview} className="w-full h-full object-cover" />
                                   <button onClick={() => setQueuedFiles(prev => prev.filter(f => f.id !== q.id))} className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow-lg"><X size={12}/></button>
                                </div>
                             ))}
                             <label className="w-24 h-32 flex-none border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-300 active:scale-95 transition-all">
                                <Plus size={20}/>
                                <input type="file" multiple className="hidden" onChange={e => {
                                   if(e.target.files) {
                                      const arr = Array.from(e.target.files).map(f => ({ id: Math.random().toString(), file: f, preview: URL.createObjectURL(f) }));
                                      setQueuedFiles(prev => [...prev, ...arr]);
                                   }
                                }} />
                             </label>
                          </div>
                          <button onClick={startAiAudit} disabled={importing} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-3 mt-4 active:scale-[0.98]">
                             {importing ? <Loader2 className="animate-spin" size={18}/> : <ScanLine size={18}/>}
                             {importing ? 'Scanning...' : 'Audit Document'}
                          </button>
                       </div>
                    ) : (
                       <label className="block p-12 bg-white border-4 border-dashed border-slate-100 rounded-[3rem] text-center hover:border-blue-400 transition-all cursor-pointer">
                          <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
                          <h4 className="font-black text-slate-900">Upload Dealer Invoice</h4>
                          <p className="text-slate-400 text-xs mt-1 font-bold">PDF or Images</p>
                          <input type="file" multiple className="hidden" onChange={e => {
                             if(e.target.files) {
                                const arr = Array.from(e.target.files).map(f => ({ id: Math.random().toString(), file: f, preview: URL.createObjectURL(f) }));
                                setQueuedFiles(arr);
                             }
                          }} />
                       </label>
                    )}
                  </div>
                )}

                {previewData.length > 0 && (
                   <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-elevated overflow-hidden flex flex-col max-h-[80vh] animate-slide-up">
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 text-white rounded-xl"><ShieldCheck size={20}/></div>
                            <h4 className="font-black text-slate-900 text-sm uppercase">Audit Review</h4>
                         </div>
                         <button onClick={() => setPreviewData([])} className="text-slate-400"><X size={20}/></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                         {previewData.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border transition-all ${item.hasError ? 'bg-rose-50 border-rose-100 shadow-md' : 'bg-white border-slate-100 shadow-sm'}`}>
                               <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 min-w-0 pr-4">
                                     <p className="font-black text-slate-900 tracking-tight truncate">{item.partNumber}</p>
                                     <p className="text-[10px] font-bold text-slate-400 truncate">{item.name}</p>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Qty</span>
                                     <p className="font-black text-slate-900">{item.quantity}</p>
                                  </div>
                               </div>
                               <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 mt-1">
                                  <div>
                                     <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Billed Disc</p>
                                     <p className={`font-black text-xs ${item.hasError ? 'text-rose-600' : 'text-slate-600'}`}>{item.discountPercent}%</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Net Rate</p>
                                     <p className="font-black text-sm text-blue-600">₹{item.printedUnitPrice.toLocaleString()}</p>
                                  </div>
                               </div>
                               {item.hasError && (
                                  <div className="mt-3 flex items-center gap-2 text-rose-700 bg-white/50 p-2 rounded-xl">
                                     <AlertTriangle size={14} className="text-rose-500" />
                                     <p className="text-[9px] font-bold uppercase tracking-tight">Leakage detected: Under 12% B.DC</p>
                                  </div>
                                )}
                            </div>
                         ))}
                      </div>
                      <div className="p-5 border-t border-slate-100 bg-white shadow-2xl">
                         <button onClick={confirmSync} disabled={importing} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]">
                            {importing ? <Loader2 className="animate-spin" size={20}/> : <Check size={20}/>}
                            Confirm & Update Stock
                         </button>
                      </div>
                   </div>
                )}

                {importLog && (
                   <div className="bg-white p-10 rounded-[3rem] border border-green-100 shadow-xl text-center flex flex-col items-center animate-fade-in">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg"><CheckCircle2 size={32}/></div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-4">Stock Integrated</h4>
                      <p className="text-sm font-bold text-slate-400 max-w-xs leading-relaxed">Successfully audited and synchronized <b>{importLog.count} items</b> with your master catalog.</p>
                      <button onClick={() => setImportLog(null)} className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] hover:text-brand-600 transition-colors">Start New Scan</button>
                   </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="h-full flex flex-col p-4 space-y-4 max-w-5xl mx-auto overflow-y-auto no-scrollbar pb-32">
                {loading ? <TharLoader /> : history.length === 0 ? <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest text-[10px]">No inbound history</div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {history.map(tx => (
                        <div key={tx.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:border-brand-200 transition-all group animate-fade-in">
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex-1 min-w-0 pr-4">
                                 <h4 className="font-black text-slate-900 leading-tight truncate group-hover:text-brand-600 transition-colors">{tx.partNumber}</h4>
                                 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1"><Calendar size={12}/> {new Date(tx.createdAt).toLocaleDateString()}</div>
                              </div>
                              <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-black text-[10px] shadow-sm">+{tx.quantity}</div>
                           </div>
                           <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-2">
                              <div>
                                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Source</p>
                                 <p className="text-[12px] font-bold text-slate-700 truncate max-w-[120px]">{tx.customerName}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Inbound Val</p>
                                 <p className="text-lg font-black text-slate-900 tabular-nums">₹{(tx.price * tx.quantity).toLocaleString()}</p>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                )}
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;
