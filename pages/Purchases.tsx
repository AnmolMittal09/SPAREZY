
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
  User as UserIcon,
  Users,
  Search,
  RotateCcw,
  FileSpreadsheet,
  Sparkles,
  Percent
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
  const [historySearch, setHistorySearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand>(Brand.HYUNDAI);

  const currentDiscountRate = selectedBrand === Brand.MAHINDRA ? 19.36 : 12;

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

  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    const q = historySearch.toLowerCase();
    return history.filter(tx => 
      tx.partNumber.toLowerCase().includes(q) || 
      (tx.customerName && tx.customerName.toLowerCase().includes(q))
    );
  }, [history, historySearch]);

  const stackedHistory = useMemo(() => {
    const groups: Record<string, GroupedInbound> = {};
    filteredHistory.forEach(tx => {
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
  }, [filteredHistory, sortOrder]);

  const parseSupplier = (name: string) => {
    if (!name) return { supplier: 'Main Provider', invDate: null };
    const parts = name.split(' (INV: ');
    if (parts.length > 1) {
      return { 
        supplier: parts[0].trim(), 
        invDate: parts[1].replace(')', '').trim() 
      };
    }
    return { supplier: name, invDate: null };
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

  const removeQueuedFile = (id: string) => {
    setQueuedFiles(prev => prev.filter(f => f.id !== id));
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
          const calculatedAtRate = mrp * (1 - (currentDiscountRate/100));
          let hasError = disc < currentDiscountRate || Math.abs(printed - calculatedAtRate) > 0.5;
          let errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE' = 'NONE';
          if (disc < currentDiscountRate) errorType = 'DISCOUNT_LOW';
          else if (Math.abs(printed - calculatedAtRate) > 0.5) errorType = 'CALC_MISMATCH';

          return {
            partNumber: String(row[0] || '').toUpperCase().trim(),
            name: String(row[1] || 'Excel Row'),
            quantity: Number(row[5] || 1),
            mrp, discountPercent: disc, printedUnitPrice: printed, calculatedPrice: calculatedAtRate, hasError, errorType, diff: printed - calculatedAtRate
          };
        }).filter(i => i.partNumber && i.quantity > 0);
        setPreviewData(parsed as any);
      } else {
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
        if (result && result.items && result.items.length > 0) {
          setExtractedMetadata({ dealerName: result.dealerName, invoiceDate: result.invoiceDate });
          const verifiedItems = result.items.map((item: any) => {
            const expected = item.mrp * (1 - currentDiscountRate / 100);
            const diff = item.printedUnitPrice - expected;
            const hasError = item.discountPercent < currentDiscountRate || Math.abs(diff) > 0.5;
            return {
              ...item,
              partNumber: item.partNumber.toUpperCase().trim(),
              calculatedPrice: parseFloat(expected.toFixed(2)),
              hasError, errorType: item.discountPercent < currentDiscountRate ? 'DISCOUNT_LOW' : (Math.abs(diff) > 0.5 ? 'CALC_MISMATCH' : 'NONE'),
              diff: parseFloat(diff.toFixed(2))
            };
          });
          setPreviewData(verifiedItems);
        } else throw new Error("Extraction failed: items not found.");
      }
    } catch (err: any) { setErrorMsg(err.message); } 
    finally { setImporting(false); }
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
                brand: selectedBrand
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
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>History</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={24} /></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Purchase Inbound</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acquisition Journal</p>
             </div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={16} /> New</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> AI Audit</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><History size={16} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 no-scrollbar bg-white md:rounded-[2.5rem] shadow-soft border border-slate-100">
                {!previewData.length && !importLog && (
                  <div className="max-w-2xl mx-auto space-y-8">
                     
                     {/* BRAND TOGGLE FOR AI SCAN */}
                     <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-inner-soft flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Audit Protocol Select</h4>
                           <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                              <Percent size={12} strokeWidth={3} />
                              <span className="text-[9px] font-black uppercase tracking-widest">Rule: {currentDiscountRate}% Off</span>
                           </div>
                        </div>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft">
                            {( [Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                               <button 
                                 key={b}
                                 onClick={() => setSelectedBrand(b)}
                                 className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                                   selectedBrand === b 
                                     ? 'bg-slate-900 text-white shadow-xl' 
                                     : 'text-slate-400 hover:text-slate-600'
                                 }`}
                               >
                                 {b}
                               </button>
                            ))}
                        </div>
                     </div>

                     <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-[2.5rem] p-12 text-center group hover:bg-blue-50 transition-all cursor-pointer relative overflow-hidden">
                        <input type="file" multiple accept="image/*, application/pdf, .xlsx, .csv" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-blue-600 shadow-xl shadow-blue-100 mx-auto mb-6 group-hover:scale-110 transition-transform">
                           <Upload size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Drop Original Invoices</h3>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Images, PDFs or Vendor Excel Spreadsheets</p>
                     </div>

                     {queuedFiles.length > 0 && (
                        <div className="space-y-4 animate-fade-in">
                           <div className="flex items-center justify-between px-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queue ({queuedFiles.length})</span>
                              <button onClick={() => setQueuedFiles([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Clear All</button>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {queuedFiles.map(q => (
                                 <div key={q.id} className="relative aspect-square bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden group">
                                    {q.file.type.startsWith('image/') ? (
                                       <img src={q.preview} className="w-full h-full object-cover" />
                                    ) : (
                                       <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                                          <FileText className="text-slate-300" size={32} />
                                          <span className="text-[9px] font-black text-slate-500 uppercase truncate w-full">{q.file.name}</span>
                                       </div>
                                    )}
                                    <button onClick={() => removeQueuedFile(q.id)} className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                 </div>
                              ))}
                           </div>
                           <button 
                             onClick={startAiAudit}
                             disabled={importing}
                             className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 shadow-xl shadow-blue-200 active:scale-[0.98] transition-all uppercase text-sm tracking-widest disabled:opacity-50"
                           >
                              {importing ? <Loader2 className="animate-spin" size={24} /> : <ScanLine size={24} strokeWidth={2.5} />}
                              {importing ? 'Scanning Assets...' : `Run ${selectedBrand} Audit`}
                           </button>
                        </div>
                     )}
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="animate-fade-in space-y-6">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20"><Sparkles size={28} strokeWidth={2.5} /></div>
                           <div>
                              <h3 className="text-2xl font-black tracking-tight uppercase leading-none mb-2">{extractedMetadata.dealerName || 'Extracted Dealer'}</h3>
                              <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-blue-400">
                                 <span className="bg-white/10 text-white px-3 py-1 rounded-lg ring-1 ring-white/20">{selectedBrand}</span>
                                 <div className="flex items-center gap-1.5"><Calendar size={14} /> {extractedMetadata.invoiceDate || 'No Date'}</div>
                                 <div className="flex items-center gap-1.5"><Layers size={14} /> {fd(previewData.length)} Assets Logged</div>
                              </div>
                           </div>
                        </div>
                        <div className="flex gap-3 relative z-10 w-full md:w-auto">
                           <button onClick={() => { setPreviewData([]); setQueuedFiles([]); }} className="flex-1 md:flex-none px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Cancel</button>
                           <button onClick={confirmBulkImport} disabled={importing} className="flex-1 md:flex-none px-12 py-4 bg-blue-600 hover:bg-blue-50 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                              {importing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                              {importing ? 'Synchronizing...' : 'Sync to Ledger'}
                           </button>
                        </div>
                     </div>

                     <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-soft">
                        <table className="w-full text-left text-sm border-collapse">
                           <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                              <tr>
                                 <th className="px-8 py-6">Identity / Part</th>
                                 <th className="px-8 py-6 text-center">Batch Qty</th>
                                 <th className="px-8 py-6 text-right">Extracted B.DC</th>
                                 <th className="px-8 py-6 text-right">Printed Net</th>
                                 <th className="px-8 py-6 text-right">Protocol Audit ({currentDiscountRate}%)</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {previewData.map((item, idx) => (
                                 <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${item.hasError ? 'bg-rose-50/20' : ''}`}>
                                    <td className="px-8 py-6">
                                       <div className="font-black text-slate-900 text-base uppercase tracking-tight mb-1">{item.partNumber}</div>
                                       <div className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-xs">{item.name}</div>
                                    </td>
                                    <td className="px-8 py-6 text-center font-black text-slate-900 text-lg tabular-nums">#{fd(item.quantity)}</td>
                                    <td className="px-8 py-6 text-right">
                                       <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${item.discountPercent < currentDiscountRate ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                          {item.discountPercent.toFixed(1)}% OFF
                                       </span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-black text-slate-900 text-lg tabular-nums">₹{item.printedUnitPrice.toLocaleString()}</td>
                                    <td className="px-8 py-6 text-right">
                                       {item.hasError ? (
                                          <div className="flex flex-col items-end gap-1">
                                             <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-black uppercase tracking-widest">
                                                <AlertTriangle size={14} /> Protocol Break
                                             </div>
                                             <span className="text-[8px] font-bold text-slate-400 uppercase">Yield Loss: ₹{item.diff.toFixed(2)} / Unit</span>
                                          </div>
                                       ) : (
                                          <div className="flex items-center justify-end gap-1.5 text-teal-600 text-[10px] font-black uppercase tracking-widest">
                                             <ShieldCheck size={14} /> Verified
                                          </div>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                )}

                {importLog && (
                  <div className="max-w-xl mx-auto bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium text-center animate-slide-up">
                     <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl ${importLog.success ? 'bg-teal-50 text-teal-600 shadow-teal-100' : 'bg-rose-50 text-rose-600 shadow-rose-100'}`}>
                        {importLog.success ? <Check size={40} strokeWidth={4} /> : <AlertCircle size={40} strokeWidth={4} />}
                     </div>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-4">{importLog.message}</h3>
                     <div className="grid grid-cols-2 gap-4 mb-10">
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Asset Volume</p>
                           <p className="text-2xl font-black text-slate-900">{fd(importLog.count)} SKUs</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grand Value</p>
                           <p className="text-2xl font-black text-slate-900">₹{importLog.totalValue.toLocaleString()}</p>
                        </div>
                     </div>
                     <button onClick={() => setImportLog(null)} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest shadow-xl">Complete Workflow</button>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-slate-50 md:bg-white md:rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-4 md:p-8 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                   <div className="flex items-center gap-5 w-full md:w-auto">
                      <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><History size={24} /></div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-[14px] uppercase tracking-wider leading-none mb-1.5">Acquisition Journal</span>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Inbound Batches Registry</span>
                      </div>
                   </div>
                   <div className="flex gap-2 w-full md:w-auto px-1">
                      <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                         <input 
                            type="text" 
                            placeholder="Find by Supplier..." 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold shadow-inner-soft outline-none transition-all uppercase tracking-tight"
                            value={historySearch}
                            onChange={e => setHistorySearch(e.target.value)}
                         />
                      </div>
                      <button onClick={loadHistory} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-soft"><RotateCcw size={20} className={loading ? 'animate-spin' : ''} /></button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
                   {loading ? <div className="flex justify-center p-12"><TharLoader /></div> : (
                        <div className="flex flex-col gap-3">
                           {stackedHistory.length === 0 ? (
                             <div className="py-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <History size={64} className="opacity-10 mb-6" />
                                <p className="font-black uppercase tracking-[0.3em] text-slate-300">Journal Clear</p>
                             </div>
                           ) : (
                             stackedHistory.map(stack => {
                                const { supplier, invDate } = parseSupplier(stack.customerName);
                                return (
                                  <div 
                                    key={stack.id} 
                                    onClick={() => setSelectedInbound(stack)} 
                                    className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-200 shadow-soft hover:shadow-premium hover:border-blue-200 active:scale-[0.99] transition-all cursor-pointer group animate-fade-in relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8"
                                  >
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    <div className="flex items-center gap-5 min-w-0 flex-1">
                                      <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors border border-slate-100">
                                         <Truck size={20} strokeWidth={2.5}/>
                                      </div>
                                      <div className="min-w-0">
                                         <h3 className="font-black text-[16px] md:text-lg text-slate-900 uppercase tracking-tight truncate leading-none group-hover:text-blue-600 transition-colors">
                                            {supplier}
                                         </h3>
                                         <div className="flex flex-col gap-1 mt-2">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                               <Calendar size={12} className="text-blue-600" />
                                               <span>Invoice Date: {invDate || new Date(stack.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] opacity-80 pl-0.5">
                                               <Clock size={10} />
                                               <span>Scanned: {new Date(stack.createdAt).toLocaleDateString()} at {new Date(stack.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                         </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-6 md:gap-12 border-t md:border-t-0 border-slate-50 pt-4 md:pt-0">
                                      <div className="flex flex-col items-start md:items-end">
                                         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">INVENTORY UNITS</span>
                                         <div className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 flex items-center gap-2 shadow-inner-soft">
                                            <Package size={12} className="text-slate-400"/>
                                            <span className="text-[10px] font-black text-slate-600">{fd(stack.items.length)} ASSETS</span>
                                         </div>
                                      </div>
                                      <div className="text-right">
                                         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 block">BATCH VALUE</span>
                                         <p className="font-black text-xl md:text-2xl text-slate-900 tracking-tighter tabular-nums leading-none">₹{stack.totalValue.toLocaleString()}</p>
                                      </div>
                                      <div className="hidden md:block">
                                         <ChevronRight size={20} className="text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                      </div>
                                    </div>
                                  </div>
                                );
                             })
                           )}
                        </div>
                   )}
                </div>
             </div>
          )}
       </div>

       {selectedInbound && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center animate-fade-in no-scrollbar">
              <div className="bg-white w-full rounded-t-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up pb-safe no-scrollbar">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedInbound(null)} className="p-3 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={22} strokeWidth={3}/></button>
                          <div className="min-w-0">
                              <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[250px] tracking-tight">{parseSupplier(selectedInbound.customerName).supplier}</h3>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{new Date(selectedInbound.createdAt).toLocaleDateString()} • {new Date(selectedInbound.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-4 bg-slate-50/30 pb-24">
                      {selectedInbound.items.map((item) => (
                        <div key={item.id} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 flex flex-col gap-5 shadow-soft animate-fade-in hover:border-blue-100 transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4 flex-1">
                                    <div className="font-black text-slate-900 text-lg uppercase leading-tight mb-1.5 tracking-tight group-hover:text-blue-600 transition-colors">{item.partNumber}</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Cost: ₹{item.price.toLocaleString()}</p>
                                </div>
                                <div className="text-right flex-none">
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">INBOUND QTY</p>
                                    <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{fd(item.quantity)}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-50 pt-5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ASSET ADDITION</span>
                                <span className="font-black text-xl text-slate-900 tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        </div>
                      ))}
                  </div>
                  <div className="p-8 border-t border-slate-100 bg-white">
                      <div className="flex justify-between items-center mb-8">
                          <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1">AGGREGATE ACQUISITION</span>
                              <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none tabular-nums">₹{selectedInbound.totalValue.toLocaleString()}</span>
                          </div>
                          <button onClick={() => setSelectedInbound(null)} className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-all text-[12px] uppercase tracking-widest shadow-xl border border-white/10">Terminate Log</button>
                      </div>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;
