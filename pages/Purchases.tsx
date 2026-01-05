
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
  // Fix: Added missing RefreshCw import
  RefreshCw
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import TharLoader from '../components/TharLoader';
import * as XLSX from 'xlsx';

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
    const data = await fetchTransactions(undefined, TransactionType.PURCHASE);
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
        } else throw new Error("Extraction failed.");
      }
    } catch (err: any) { setErrorMsg(err.message); } 
    finally { setImporting(false); }
  };

  const confirmBulkImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);
    const sourceName = extractedMetadata.dealerName ? `${extractedMetadata.dealerName} (Inv: ${extractedMetadata.invoiceDate})` : `AI Audit (${new Date().toLocaleDateString()})`;
    try {
        const inventoryPayload = previewData.map(item => {
            const existing = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
            return {
                partNumber: item.partNumber, name: item.name, price: item.mrp,
                quantity: (existing?.quantity || 0) + item.quantity,
                brand: item.partNumber.startsWith('HY') ? Brand.HYUNDAI : item.partNumber.startsWith('MH') ? Brand.MAHINDRA : undefined
            };
        });
        // For managers, this remains a request. For owners, it's immediate.
        const syncRes = await updateOrAddItems(inventoryPayload, { fileName: `Inbound: ${sourceName}`, mode: 'PURCHASE' });
        const txPayload = previewData.map(item => ({
            partNumber: item.partNumber, type: TransactionType.PURCHASE, quantity: item.quantity,
            price: item.printedUnitPrice, customerName: sourceName, createdByRole: user.role
        }));
        await createBulkTransactions(txPayload);
        setImportLog({ 
            success: true, message: "Registry Synced.", count: previewData.length,
            totalValue: txPayload.reduce((s, i) => s + (i.price * i.quantity), 0),
            errorCount: previewData.filter(i => i.hasError).length,
            addedCount: syncRes.added, updatedCount: syncRes.updated, dealer: extractedMetadata.dealerName
        });
        setPreviewData([]); setQueuedFiles([]);
    } catch (err: any) { setImportLog({ success: false, message: err.message, count: 0, totalValue: 0, errorCount: 0 }); }
    finally { setImporting(false); loadHistory(); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent animate-fade-in">
       {/* MOBILE TAB NAV */}
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>POS</button>
               <button onClick={() => setActiveTab('IMPORT')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>SCAN</button>
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>JOURNAL</button>
            </div>
         </div>
       )}

       {/* DESKTOP HEADER */}
       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={28} /></div>
             <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">Acquisition</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Inbound Document Protocol • Manager Terminal</p>
             </div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={16} /> New Batch</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> AI Audit</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><History size={16} /> Journal</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-8 flex flex-col h-full overflow-y-auto no-scrollbar pb-40">
                {!previewData.length && !importLog && (
                  <div className="space-y-8 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-[3rem] p-12 text-center group shadow-premium">
                        <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-[2.25rem] flex items-center justify-center mx-auto mb-10 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner-soft"><ImageIcon size={48} /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Invoice Digitsation</h2>
                        <p className="text-slate-400 mb-12 max-w-xs mx-auto text-[15px] font-bold leading-relaxed">Upload provider invoices to auto-verify B.DC accuracy and initialize registry entries.</p>
                        <label className="inline-flex items-center gap-4 bg-blue-600 hover:bg-blue-700 text-white font-black px-16 py-7 rounded-[2.5rem] cursor-pointer transition-all active:scale-95 shadow-elevated shadow-blue-500/20 uppercase text-[13px] tracking-[0.2em]">
                           <Upload size={24} strokeWidth={3} /> Select Assets
                           <input type="file" multiple accept="image/*, application/pdf" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-elevated animate-slide-up">
                        <div className="flex justify-between items-center mb-8">
                           <h4 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px]">Transmission Queue ({queuedFiles.length} Pages)</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-500 font-black text-[10px] uppercase tracking-widest hover:underline">Drop Session</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-3xl overflow-hidden border border-slate-100 shadow-soft bg-slate-50">
                                <img src={q.preview} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                <button onClick={() => removeFileFromQueue(q.id)} className="absolute top-3 right-3 p-2 bg-rose-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                                   <p className="text-white text-[10px] font-black uppercase tracking-widest">Page {queuedFiles.indexOf(q) + 1}</p>
                                </div>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:bg-slate-50 cursor-pointer transition-all">
                              <Plus size={24} strokeWidth={3} />
                              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        <div className="mt-10 border-t border-slate-50 pt-8">
                          <button onClick={startAiAudit} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all text-[15px] uppercase tracking-[0.2em]">
                            {importing ? <Loader2 className="animate-spin" /> : <ScanLine size={24} />}
                            {importing ? 'Processing Ledger...' : 'Initialize AI Audit'}
                          </button>
                        </div>
                      </div>
                    )}
                    {errorMsg && <div className="mt-10 p-8 bg-rose-50 text-rose-600 rounded-[2.5rem] border border-rose-100 text-xs font-black flex items-center gap-5 justify-center uppercase tracking-widest shadow-soft animate-shake"><AlertCircle size={26} /> {errorMsg}</div>}
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[3.5rem] shadow-premium border border-slate-200/80 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
                     <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <div className="flex items-center gap-6">
                           <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-500/20"><ShieldCheck size={28} strokeWidth={2.5} /></div>
                           <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2">Audit Registry</h3>
                              <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Verification Protocol: 12% Basic Discount</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-3 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                     </div>
                     <div className="flex-1 overflow-y-auto no-scrollbar bg-white divide-y divide-slate-50">
                        {previewData.map((row, i) => (
                           <div key={i} className={`px-10 py-10 group transition-all ${row.hasError ? 'bg-rose-50/20' : 'hover:bg-slate-50/30'}`}>
                                <div className="flex justify-between items-start gap-10 mb-8">
                                   <div className="flex-1 min-w-0">
                                      <div className="font-black text-slate-900 text-2xl uppercase tracking-tighter mb-2 group-hover:text-blue-600 transition-colors">{row.partNumber}</div>
                                      <div className="text-[13px] text-slate-400 font-bold truncate uppercase tracking-tight">{row.name}</div>
                                   </div>
                                   <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[14px] font-black tabular-nums shadow-lg">
                                      {row.quantity} Units
                                   </div>
                                </div>
                                <div className="grid grid-cols-3 gap-12 py-6 border-t border-slate-100/80">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Registry MRP</p>
                                        <p className="font-black text-slate-500 text-base">₹{row.mrp.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Basic DC</p>
                                        <p className={`font-black text-base ${row.discountPercent < 12 ? 'text-rose-600' : 'text-slate-600'}`}>{row.discountPercent}%</p>
                                    </div>
                                    <div className="space-y-1.5 text-right">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Inbound Rate</p>
                                        <p className="font-black text-blue-600 text-2xl tracking-tighter">₹{row.printedUnitPrice.toLocaleString()}</p>
                                    </div>
                                </div>
                                {row.hasError && (
                                    <div className="mt-6 bg-rose-600 text-white p-5 rounded-3xl flex gap-4 items-center shadow-lg shadow-rose-200 animate-slide-up">
                                        <AlertTriangle size={22} strokeWidth={3} className="flex-none" />
                                        <div className="text-[11px] font-black uppercase tracking-widest leading-relaxed">
                                          Discrepancy: {row.errorType === 'DISCOUNT_LOW' ? `Low basic discount detected (${row.discountPercent}% vs expected 12%)` : `Rounding mismatch of ₹${Math.abs(row.diff)} per unit`}
                                        </div>
                                    </div>
                                )}
                           </div>
                        ))}
                     </div>
                     <div className="p-10 border-t border-slate-100 bg-white shadow-inner-soft">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-7 rounded-[2.5rem] shadow-2xl flex items-center justify-center gap-5 active:scale-[0.98] transition-all uppercase text-[15px] tracking-widest">
                          {importing ? <Loader2 className="animate-spin" size={24} /> : <Database size={28} />} Synchronize with Master Ledger
                        </button>
                     </div>
                  </div>
                )}

                {importLog && (
                  <div className="p-16 rounded-[4rem] border border-slate-100 flex flex-col items-center text-center animate-slide-up shadow-premium bg-white">
                      <div className={`w-32 h-32 rounded-[3rem] mb-12 flex items-center justify-center shadow-xl ${importLog.success ? 'bg-teal-50 text-teal-600 shadow-teal-100' : 'bg-rose-50 text-rose-600 shadow-rose-100'}`}>
                        {importLog.success ? <CheckCircle2 size={64} strokeWidth={2.5} /> : <AlertCircle size={64} strokeWidth={2.5} />}
                      </div>
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{importLog.success ? 'Synchronization Ready' : 'Protocol Terminated'}</h3>
                      <p className="mt-6 font-bold text-slate-400 text-lg max-w-sm leading-relaxed">
                         {importLog.success ? `Verification complete for ${importLog.count} items. ${user.role === Role.MANAGER ? 'Inbound batch queued for final admin authorization.' : 'Stock balances successfully finalized.'}` : importLog.message}
                      </p>
                      <button onClick={() => { setImportLog(null); setPreviewData([]); setQueuedFiles([]); }} className="mt-16 text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] hover:text-blue-600 transition-colors active:scale-95">Initialize New Batch</button>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-[3.5rem] shadow-premium border border-slate-200/60 flex flex-col h-full overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
                   <div className="flex items-center gap-5">
                      <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200"><Truck size={28} strokeWidth={2.5} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-2xl tracking-tighter block uppercase leading-none mb-1.5">Acquisition Journal</span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Chronological Ledger Logs</span>
                      </div>
                   </div>
                   <button onClick={loadHistory} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl transition-all active:rotate-180 duration-500 shadow-soft border border-slate-100"><RefreshCw size={22} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 no-scrollbar pb-40 bg-slate-50/20">
                  {loading ? <TharLoader /> : history.length === 0 ? <div className="p-48 text-center opacity-10"><History size={100} className="mx-auto" /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {stackedHistory.map(stack => (
                            <div key={stack.id} onClick={() => setSelectedInbound(stack)} className="p-10 bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-soft hover:border-blue-300 hover:shadow-xl transition-all cursor-pointer group relative animate-fade-in flex flex-col">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">INBOUND LOG</span>
                                        </div>
                                        <div className="text-[12px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest"><Calendar size={14} className="opacity-40"/> {new Date(stack.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="bg-slate-900 text-white w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-lg active:scale-90 transition-all group-hover:bg-blue-600"><ChevronRight size={26} /></div>
                                </div>
                                <div className="mb-10 flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Registry Entity</p>
                                    <div className="font-black text-xl text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors uppercase">{stack.customerName || 'Inbound Batch'}</div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-50 pt-8 mt-auto">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Liability</p>
                                        <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">₹{stack.totalValue.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>

       {/* INBOUND DETAIL MODAL */}
       {selectedInbound && (
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in overflow-hidden">
              <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up relative">
                  <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                      <div className="flex items-center gap-6">
                          <button onClick={() => setSelectedInbound(null)} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl border border-slate-100 active:scale-90 transition-all shadow-soft"><ArrowLeft size={24}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-3xl tracking-tighter leading-none mb-2 uppercase">{selectedInbound.customerName || 'Acquisition Detail'}</h3>
                              <div className="flex items-center gap-4 text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                                  <Calendar size={14} className="opacity-40"/> {new Date(selectedInbound.createdAt).toLocaleDateString()}
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  <Clock size={14} className="opacity-40"/> {new Date(selectedInbound.createdAt).toLocaleTimeString()}
                              </div>
                          </div>
                      </div>
                      <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg">{selectedInbound.items.length} Items</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar space-y-6 bg-slate-50/30">
                      {selectedInbound.items.map((item, idx) => (
                          <div key={item.id} className="p-8 bg-white rounded-[3rem] border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-8 hover:border-blue-300 hover:shadow-soft transition-all group">
                              <div className="flex items-center gap-8">
                                  <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] border border-slate-100 flex items-center justify-center font-black text-slate-300 text-lg group-hover:text-blue-500 transition-colors">{idx + 1}</div>
                                  <div>
                                      <div className="font-black text-slate-900 text-xl tracking-tight leading-none uppercase mb-2 group-hover:text-blue-600 transition-colors">{item.partNumber}</div>
                                      <p className="text-[12px] text-slate-400 font-bold uppercase tracking-[0.2em]">Net Unit Rate: ₹{item.price.toLocaleString()}</p>
                                  </div>
                              </div>
                              <div className="flex items-center justify-between md:justify-end gap-16 border-t md:border-t-0 border-slate-100 pt-8 md:pt-0">
                                  <div className="text-right">
                                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Quantity</p>
                                      <p className="text-2xl font-black text-slate-900 tabular-nums">{item.quantity} PCS</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Asset Total</p>
                                      <p className="text-2xl font-black text-blue-600 tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-10 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-10 sticky bottom-0 z-10 shadow-inner-soft">
                      <div className="flex items-center gap-8">
                          <div className="p-5 bg-slate-900 text-white rounded-[2rem] shadow-xl shadow-slate-200"><Database size={36} strokeWidth={2.5} /></div>
                          <div>
                              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1">Batch Value Logged</p>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{selectedInbound.totalValue.toLocaleString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedInbound(null)} className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-16 py-6 rounded-[2.5rem] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]">Close Registry View</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;
