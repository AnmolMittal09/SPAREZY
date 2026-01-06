import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Brand, Role } from '../types';
import DailyTransactions from './DailyTransactions';
import { 
  History, 
  PlusCircle, 
  Loader2, 
  X, 
  ArrowRight, 
  Calendar, 
  Truck, 
  Clock, 
  ChevronRight, 
  Database, 
  FileText, 
  ScanLine, 
  Calculator, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  List, 
  ArrowLeft, 
  Package, 
  ArrowUpDown, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Zap, 
  Check,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Upload,
  User as UserIcon
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import TharLoader from '../components/TharLoader';
import * as XLSX from 'xlsx';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

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

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'IMPORT' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<'STACKED' | 'LIST'>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ success: boolean; message: string; count: number; totalValue: number; errorCount: number; addedCount?: number; updatedCount?: number; dealer?: string } | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<{ dealerName?: string; invoiceDate?: string }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const STANDARD_DISCOUNT = 12;

  useEffect(() => {
    if (activeTab === 'HISTORY') loadHistory();
    fetchInventory().then(setInventory);
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.PURCHASE);
    setHistory(data);
    setLoading(false);
  };

  const stackedHistory = useMemo(() => {
    const groups: Record<string, GroupedInbound> = {};
    history.forEach(tx => {
       const key = `${tx.createdAt}_${tx.customerName}`;
       if (!groups[key]) {
         groups[key] = {
           id: tx.id,
           createdAt: tx.createdAt,
           customerName: tx.customerName,
           items: [],
           totalValue: 0
         };
       }
       groups[key].items.push(tx);
       groups[key].totalValue += (tx.price * tx.quantity);
    });
    const result = Object.values(groups);
    result.sort((a, b) => {
       const timeA = new Date(a.createdAt).getTime();
       const timeB = new Date(b.createdAt).getTime();
       return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [history, sortOrder]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newQueued: QueuedFile[] = Array.from(files).map((f: File) => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        preview: URL.createObjectURL(f)
    }));
    setQueuedFiles(prev => [...prev, ...newQueued]);
    e.target.value = '';
  };

  const removeFileFromQueue = (id: string) => {
    setQueuedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const startAiAudit = async () => {
    if (queuedFiles.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    setPreviewData([]);
    setExtractedMetadata({});
    setImportLog(null);

    try {
      const excelFile = queuedFiles.find(q => q.file.name.match(/\.(xlsx|xls|xlsb|xlsm|csv)$/i));
      if (excelFile) {
        const data = await excelFile.file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (!jsonData || jsonData.length < 1) throw new Error("Spreadsheet is empty.");

        const parsed = jsonData.slice(1).map(row => {
          const mrp = Number(row[2] || 0);
          const disc = Number(row[3] || 0);
          const printed = Number(row[4] || mrp * (1 - disc/100));
          const calculatedAt12 = mrp * (1 - (STANDARD_DISCOUNT/100));
          let hasError = disc < STANDARD_DISCOUNT || Math.abs(printed - calculatedAt12) > 0.5;
          let errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE' = 'NONE';
          if (disc < STANDARD_DISCOUNT) errorType = 'DISCOUNT_LOW';
          else if (Math.abs(printed - calculatedAt12) > 0.5) errorType = 'CALC_MISMATCH';

          return {
            partNumber: String(row[0] || '').toUpperCase().trim(),
            name: String(row[1] || 'Excel Row'),
            quantity: Number(row[5] || 1),
            mrp, discountPercent: disc, printedUnitPrice: printed, calculatedPrice: calculatedAt12, hasError, errorType, diff: printed - calculatedAt12
          };
        }).filter(i => i.partNumber && i.quantity > 0);
        setPreviewData(parsed as any);
      } else {
        const payload: InvoiceFile[] = [];
        for (const q of queuedFiles) {
          const base64 = await fileToBase64(q.file);
          payload.push({ data: base64, mimeType: q.file.type });
        }
        const result = await extractInvoiceData(payload);
        if (result && result.items && result.items.length > 0) {
          setExtractedMetadata({ dealerName: result.dealerName, invoiceDate: result.invoiceDate });
          const verifiedItems = result.items.map((item: any) => {
            const expected = item.mrp * 0.88;
            const diff = item.printedUnitPrice - expected;
            const hasError = item.discountPercent < 12 || Math.abs(diff) > 0.5;
            return {
              ...item,
              partNumber: item.partNumber.toUpperCase().trim(),
              calculatedPrice: parseFloat(expected.toFixed(2)),
              hasError, errorType: item.discountPercent < 12 ? 'DISCOUNT_LOW' : (Math.abs(diff) > 0.5 ? 'CALC_MISMATCH' : 'NONE'),
              diff: parseFloat(diff.toFixed(2))
            };
          });
          setPreviewData(verifiedItems);
        } else throw new Error("Extraction failed: items not found.");
      }
    } catch (err: any) { setErrorMsg(err.message); } 
    finally { setImporting(false); }
  };

  const updatePreviewQty = (index: number, newQty: number) => {
    setPreviewData(prev => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(1, newQty) } : item));
  };

  const confirmBulkImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);
    const sourceName = (extractedMetadata.dealerName ? `${extractedMetadata.dealerName} (Inv: ${extractedMetadata.invoiceDate})` : `AI Audit (${new Date().toLocaleDateString()})`).toUpperCase().trim();
    
    try {
        const inventoryPayload = previewData.map(item => {
            const existing = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
            return {
                partNumber: item.partNumber, name: item.name, price: item.mrp,
                quantity: (existing?.quantity || 0) + item.quantity,
                brand: item.partNumber.startsWith('HY') ? Brand.HYUNDAI : item.partNumber.startsWith('MH') ? Brand.MAHINDRA : undefined
            };
        });
        const syncRes = await updateOrAddItems(inventoryPayload, { fileName: `Bill: ${sourceName}`, mode: 'AI_AUDIT_PURCHASE' });
        const txPayload = previewData.map(item => ({
            partNumber: item.partNumber, 
            type: TransactionType.PURCHASE, 
            quantity: item.quantity,
            price: item.printedUnitPrice, 
            paidAmount: item.printedUnitPrice * item.quantity,
            customerName: sourceName, 
            createdByRole: user.role as Role,
            createdByName: user.name
        }));
        await createBulkTransactions(txPayload);
        setImportLog({ 
            success: true, message: "Ledger Synchronized.", count: previewData.length,
            totalValue: txPayload.reduce((s, i) => s + (i.price * i.quantity), 0),
            errorCount: previewData.filter(i => i.hasError).length,
            addedCount: syncRes.added, updatedCount: syncRes.updated, dealer: extractedMetadata.dealerName
        });
        setPreviewData([]); setQueuedFiles([]);
    } catch (err: any) { setImportLog({ success: false, message: err.message, count: 0, totalValue: 0, errorCount: 0 }); }
    finally { setImporting(false); loadHistory(); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-3 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>Manual</button>
               <button onClick={() => setActiveTab('IMPORT')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-100' : 'text-slate-400'}`}>AI Scan</button>
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>History</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={24} /></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Purchase Inbound</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Registry & B.DC Verification</p>
             </div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><PlusCircle size={16} /> Manual</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><ScanLine size={16} /> AI Scan</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><History size={16} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col h-full overflow-y-auto no-scrollbar pb-40">
                {!previewData.length && !importLog && (
                  <div className="space-y-6 animate-fade-in px-2">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 text-center hover:border-blue-300 hover:bg-blue-50/10 transition-all group shadow-soft">
                        <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner-soft"><ImageIcon size={48} /></div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase">Invoice Audit</h2>
                        <p className="text-slate-400 mb-12 max-w-xs mx-auto text-[11px] font-bold leading-relaxed uppercase tracking-widest px-4">Instant PDF/Image scanning for 12% B.DC compliance verification.</p>
                        <label className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-5.5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-xl shadow-blue-500/20 uppercase text-[12px] tracking-[0.15em]">
                           <Upload size={22} strokeWidth={3} /> Select Assets
                           <input type="file" multiple accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-elevated animate-slide-up">
                        <div className="flex justify-between items-center mb-6 px-2">
                           <h4 className="font-black text-slate-900 uppercase tracking-[0.25em] text-[10px]">Queue Management ({fd(queuedFiles.length)})</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-500 font-black text-[9px] uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">Clear All</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-[2rem] overflow-hidden border border-slate-100 shadow-soft bg-slate-50">
                                <img src={q.preview} className="w-full h-full object-cover" alt="Preview" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <button onClick={() => removeFileFromQueue(q.id)} className="absolute top-3 right-3 p-2.5 bg-rose-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Trash2 size={18}/></button>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50 cursor-pointer active:scale-95 transition-all">
                              <Plus size={32} strokeWidth={3} />
                              <span className="text-[9px] font-black uppercase tracking-widest mt-3">Add More</span>
                              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        <div className="mt-8">
                          <button onClick={startAiAudit} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] text-[15px] uppercase tracking-[0.2em] border border-white/10">
                            {importing ? <Loader2 className="animate-spin" size={20}/> : <ScanLine size={24} />}
                            {importing ? 'Processing Matrix...' : 'Start Audit'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {previewData.length > 0 && (
                  <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/80 overflow-hidden flex flex-col animate-fade-in mx-2">
                     <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                        <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.2em]">Batch Reconciliation</h3>
                        <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-full border border-blue-200 uppercase tracking-widest">{fd(previewData.length)} ITEMS</span>
                     </div>
                     <div className="divide-y divide-slate-50 max-h-[65vh] overflow-y-auto no-scrollbar">
                        {previewData.map((row, i) => (
                           <div key={i} className={`p-6 flex flex-col gap-4 ${row.hasError ? 'bg-rose-50/30' : ''}`}>
                                <div className="flex justify-between items-start">
                                   <div className="flex-1 min-w-0 pr-6">
                                      <div className="font-black text-slate-900 text-lg uppercase truncate tracking-tight leading-none mb-1">{row.partNumber}</div>
                                      <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{row.name}</div>
                                   </div>
                                   <div className="text-right flex flex-col items-end">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">QTY</span>
                                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-inner-soft border border-slate-200">
                                         <input 
                                           type="number" 
                                           className="bg-white text-slate-900 px-2 py-1.5 rounded-lg text-sm font-black w-14 text-center outline-none border border-slate-200 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                           value={fd(row.quantity)}
                                           onChange={(e) => updatePreviewQty(i, parseInt(e.target.value) || 1)}
                                         />
                                      </div>
                                   </div>
                                </div>
                                <div className="flex justify-between items-center bg-white/60 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                   <div className="text-left">
                                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">MRP Rate</p>
                                      <p className="font-black text-slate-900 text-sm tabular-nums">₹{row.mrp.toLocaleString()}</p>
                                   </div>
                                   <div className="text-center">
                                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">B.DC Disc</p>
                                      <p className={`font-black text-sm px-2 py-0.5 rounded-lg inline-block ${row.discountPercent < 12 ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>{row.discountPercent}%</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Audit Rate</p>
                                      <p className="font-black text-blue-600 text-base tabular-nums">₹{row.printedUnitPrice.toLocaleString()}</p>
                                   </div>
                                </div>
                           </div>
                        ))}
                     </div>
                     <div className="p-6 border-t border-slate-100 bg-white">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] uppercase text-[15px] tracking-[0.15em] border border-white/5">
                          {importing ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24}/>} 
                          Commit Matrix
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-40 animate-fade-in px-3">
                {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div> : history.length === 0 ? <div className="p-40 text-center opacity-10"><History size={80} className="mx-auto" /></div> : (
                    stackedHistory.map(stack => (
                        <div key={stack.id} onClick={() => setSelectedInbound(stack)} className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-200/60 flex flex-col gap-5 active:scale-[0.98] transition-all relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-24 h-full bg-blue-600/[0.02] -skew-x-12 translate-x-12"></div>
                           <div className="flex justify-between items-start relative z-10">
                              <div className="flex items-center gap-3">
                                 <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><FileText size={20}/></div>
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">INBOUND BATCH</span>
                                    <span className="text-[12px] font-black text-slate-900 tracking-tight">{new Date(stack.createdAt).toLocaleDateString()}</span>
                                 </div>
                              </div>
                              <ChevronRight size={22} className="text-slate-200" />
                           </div>
                           <div className="relative z-10 px-1">
                              <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest block mb-1.5">Origin Dealer</span>
                              <div className="font-black text-[17px] text-slate-900 truncate uppercase tracking-tight leading-none">{stack.customerName || 'Direct Entry Provider'}</div>
                           </div>
                           <div className="flex justify-between items-end border-t border-slate-50 pt-5 relative z-10">
                              <div className="flex flex-col gap-1.5">
                                 <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-xl shadow-lg uppercase tracking-widest w-fit">{fd(stack.items.length)} ITEMS</span>
                                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Added by Terminal</span>
                              </div>
                              <div className="text-right">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Asset Value</span>
                                 <span className="font-black text-2xl text-slate-900 tracking-tighter tabular-nums leading-none">₹{stack.totalValue.toLocaleString()}</span>
                              </div>
                           </div>
                        </div>
                    ))
                )}
             </div>
          )}
       </div>

       {selectedInbound && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center animate-fade-in no-scrollbar">
              <div className="bg-white w-full rounded-t-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up pb-safe">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedInbound(null)} className="p-3 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={22} strokeWidth={3}/></button>
                          <div className="min-w-0">
                              <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[200px] tracking-tight">{selectedInbound.customerName || 'Bulk Inbound'}</h3>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{new Date(selectedInbound.createdAt).toLocaleDateString()} • {new Date(selectedInbound.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-4 bg-slate-50/30">
                      {selectedInbound.items.map((item, idx) => {
                          const partInfo = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
                          return (
                            <div key={item.id} className="p-6 bg-white rounded-[2rem] border border-slate-200/60 flex flex-col gap-5 shadow-soft animate-fade-in">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 pr-4 flex-1">
                                        <div className="font-black text-slate-900 text-lg uppercase leading-tight mb-1.5 tracking-tight">{item.partNumber}</div>
                                        <div className="text-[13px] text-slate-900 font-bold uppercase tracking-tight opacity-70 mb-3">{partInfo?.name || 'GENUINE RECORDED ASSET'}</div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Rate: ₹{item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right flex-none">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">UNITS</p>
                                        <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{fd(item.quantity)}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-50 pt-5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL VALUE</span>
                                    <span className="font-black text-slate-900 text-xl tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                            </div>
                          );
                      })}
                  </div>
                  <div className="p-8 border-t border-slate-100 bg-white">
                      <div className="flex justify-between items-center mb-8">
                          <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1">TOTAL ACQUISITION</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none tabular-nums">₹{selectedInbound.totalValue.toLocaleString()}</span>
                          </div>
                          <button onClick={() => setSelectedInbound(null)} className="px-10 py-5 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-all text-[12px] uppercase tracking-widest shadow-xl">Close Log</button>
                      </div>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;