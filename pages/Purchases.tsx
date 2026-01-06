
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
  ShoppingBag,
  Send,
  Inbox
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions, bulkUpdateTransactionStatus, receivePurchaseOrder } from '../services/transactionService';
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
  status?: TransactionStatus;
  items: Transaction[];
  totalValue: number;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'PO' | 'IMPORT' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<'STACKED' | 'LIST'>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [poList, setPoList] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);
  const [selectedPo, setSelectedPo] = useState<GroupedInbound | null>(null);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ success: boolean; message: string; count: number; totalValue: number; errorCount: number; addedCount?: number; updatedCount?: number; dealer?: string } | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<{ dealerName?: string; invoiceDate?: string }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const STANDARD_DISCOUNT = 12;

  useEffect(() => {
    if (activeTab === 'HISTORY') loadHistory();
    if (activeTab === 'PO') loadPOs();
    fetchInventory().then(setInventory);
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.PURCHASE);
    setHistory(data);
    setLoading(false);
  };

  const loadPOs = async () => {
    setLoading(true);
    const data = await fetchTransactions(undefined, TransactionType.PURCHASE_ORDER);
    setPoList(data);
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

  const stackedPOs = useMemo(() => {
    const groups: Record<string, GroupedInbound> = {};
    poList.forEach(tx => {
       const key = `${tx.createdAt}_${tx.customerName}`;
       if (!groups[key]) {
         groups[key] = {
           id: tx.id,
           createdAt: tx.createdAt,
           customerName: tx.customerName,
           status: tx.status,
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
  }, [poList, sortOrder]);

  const handleOrderPo = async (group: GroupedInbound) => {
      if (!confirm("Mark this order as SENT to the supplier?")) return;
      setLoading(true);
      try {
          const ids = group.items.map(i => i.id);
          await bulkUpdateTransactionStatus(ids, TransactionStatus.ORDERED);
          loadPOs();
          setSelectedPo(null);
      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleReceivePo = async (group: GroupedInbound) => {
      if (!confirm("Finalize receipt? This will add these parts to your physical stock inventory.")) return;
      setLoading(true);
      try {
          const ids = group.items.map(i => i.id);
          const items = group.items.map(i => ({ partNumber: i.partNumber, quantity: i.quantity }));
          await receivePurchaseOrder(ids, items);
          loadPOs();
          setSelectedPo(null);
          alert("Parts received and stock levels updated.");
      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setLoading(false);
      }
  };

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
            createdByRole: user.role as Role
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
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
               <button onClick={() => setActiveTab('NEW')} className={`flex-none px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>Manual</button>
               <button onClick={() => setActiveTab('PO')} className={`flex-none px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'PO' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Orders</button>
               <button onClick={() => setActiveTab('IMPORT')} className={`flex-none px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>AI Scan</button>
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-none px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>History</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={24} /></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Purchase Inbound</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Registry & PO Management</p>
             </div>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><PlusCircle size={16} /> New PO</button>
             <button onClick={() => setActiveTab('PO')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'PO' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><ShoppingBag size={16} /> Orders</button>
             <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><ScanLine size={16} /> AI Scan</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><History size={16} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'PO' && (
             <div className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-40 animate-fade-in">
                {loading ? <TharLoader /> : stackedPOs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-300 bg-white rounded-3xl border border-slate-100">
                        <ShoppingBag size={64} className="mb-6 opacity-10" />
                        <h3 className="font-black uppercase tracking-widest text-sm text-slate-900 mb-1">No Active Orders</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Generate a new Purchase Order to begin.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stackedPOs.map(po => (
                            <div key={po.id} onClick={() => setSelectedPo(po)} className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-200/60 flex flex-col gap-5 active:scale-[0.98] transition-all cursor-pointer group hover:border-indigo-200">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${
                                            po.status === TransactionStatus.PENDING ? 'bg-amber-50 text-amber-600' :
                                            po.status === TransactionStatus.ORDERED ? 'bg-indigo-50 text-indigo-600' :
                                            'bg-teal-50 text-teal-600'
                                        }`}>
                                            <ShoppingBag size={20} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ORDER LOG</span>
                                            <p className="text-[11px] font-bold text-slate-900">{new Date(po.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${
                                        po.status === TransactionStatus.PENDING ? 'bg-amber-50 text-amber-700' :
                                        po.status === TransactionStatus.ORDERED ? 'bg-indigo-600 text-white' :
                                        'bg-teal-600 text-white'
                                    }`}>
                                        {po.status}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Supplier Target</p>
                                    <div className="font-black text-base text-slate-900 truncate uppercase leading-tight">{po.customerName || 'Standard Supplier'}</div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto">
                                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                                        <Package size={12} className="text-slate-400" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{fd(po.items.length)} Line Items</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Order Est.</span>
                                        <p className="font-black text-lg text-slate-900 tabular-nums tracking-tighter">₹{po.totalValue.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          )}

          {activeTab === 'IMPORT' && (
             <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col h-full overflow-y-auto no-scrollbar pb-40">
                {!previewData.length && !importLog && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white border-2 border-slate-200/60 rounded-[2.5rem] p-10 text-center hover:border-blue-300 hover:bg-blue-50/10 transition-all group shadow-premium">
                        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[1.75rem] flex items-center justify-center mx-auto mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner-soft"><ImageIcon size={40} /></div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase">Invoice Scan</h2>
                        <p className="text-slate-400 mb-10 max-w-xs mx-auto text-xs font-bold leading-relaxed uppercase tracking-widest">Verify 12% B.DC compliance automatically.</p>
                        <label className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-10 py-5 rounded-[1.75rem] cursor-pointer transition-all active:scale-95 shadow-xl shadow-blue-500/20 uppercase text-[11px] tracking-[0.15em]">
                           <Upload size={20} strokeWidth={3} /> Select Docs
                           <input type="file" multiple accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-elevated">
                        <div className="flex justify-between items-center mb-6 px-2">
                           <h4 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[9px]">File Queue ({fd(queuedFiles.length)})</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-500 font-black text-[9px] uppercase tracking-widest">Clear</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-soft bg-slate-50">
                                <img src={q.preview} className="w-full h-full object-cover" />
                                <button onClick={() => removeFileFromQueue(q.id)} className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-lg shadow-lg"><Trash2 size={14}/></button>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-[1.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50 cursor-pointer">
                              <Plus size={24} strokeWidth={3} />
                              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        <div className="mt-8">
                          <button onClick={startAiAudit} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[1.75rem] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] text-[13px] uppercase tracking-[0.15em]">
                            {importing ? <Loader2 className="animate-spin" size={18}/> : <ScanLine size={20} />}
                            {importing ? 'Scanning...' : 'Start Audit'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {previewData.length > 0 && (
                  <div className="bg-white rounded-[2rem] shadow-premium border border-slate-200/80 overflow-hidden flex flex-col animate-fade-in">
                     <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Verify Batch</h3>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{fd(previewData.length)} ITEMS</span>
                     </div>
                     <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto no-scrollbar">
                        {previewData.map((row, i) => (
                           <div key={i} className={`p-5 flex flex-col gap-3 ${row.hasError ? 'bg-rose-50/30' : ''}`}>
                                <div className="flex justify-between items-start">
                                   <div className="flex-1 min-w-0 pr-4">
                                      <div className="font-black text-slate-900 text-[15px] uppercase truncate">{row.partNumber}</div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase truncate uppercase">{row.name}</div>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantity</span>
                                      <input 
                                        type="number" 
                                        className="bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-black w-16 text-center outline-none"
                                        value={fd(row.quantity)}
                                        onChange={(e) => updatePreviewQty(i, parseInt(e.target.value) || 1)}
                                      />
                                   </div>
                                </div>
                                <div className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-slate-100">
                                   <div className="text-center">
                                      <p className="text-[8px] font-black text-slate-300 uppercase">MRP</p>
                                      <p className="font-black text-slate-600 text-xs">₹{row.mrp}</p>
                                   </div>
                                   <div className="text-center">
                                      <p className="text-[8px] font-black text-slate-300 uppercase">Disc</p>
                                      <p className={`font-black text-xs ${row.discountPercent < 12 ? 'text-rose-600' : 'text-slate-600'}`}>{row.discountPercent}%</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[8px] font-black text-blue-400 uppercase">Rate</p>
                                      <p className="font-black text-blue-600 text-sm">₹{row.printedUnitPrice}</p>
                                   </div>
                                </div>
                           </div>
                        ))}
                     </div>
                     <div className="p-6 border-t border-slate-100 bg-white">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] uppercase text-[12px] tracking-widest">
                          {importing ? <Loader2 className="animate-spin" size={20}/> : <Check size={20}/>} Confirm Inbound
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="p-4 space-y-4 overflow-y-auto no-scrollbar pb-40 animate-fade-in">
                {loading ? <TharLoader /> : history.length === 0 ? <div className="p-40 text-center opacity-10"><History size={80} className="mx-auto" /></div> : (
                    stackedHistory.map(stack => (
                        <div key={stack.id} onClick={() => setSelectedInbound(stack)} className="bg-white p-5 rounded-[2rem] shadow-soft border border-slate-200/60 flex flex-col gap-4 active:scale-[0.98] transition-all relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-24 h-full bg-blue-600/[0.02] -skew-x-12 translate-x-12"></div>
                           <div className="flex justify-between items-start relative z-10">
                              <div className="flex items-center gap-2">
                                 <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><FileText size={16}/></div>
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">INBOUND BATCH</span>
                                    <span className="text-[11px] font-bold text-slate-900">{new Date(stack.createdAt).toLocaleDateString()}</span>
                                 </div>
                              </div>
                              <ChevronRight size={18} className="text-slate-200" />
                           </div>
                           <div className="relative z-10">
                              <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest block mb-1">Source Dealer</span>
                              <div className="font-black text-[15px] text-slate-900 truncate uppercase leading-tight">{stack.customerName || 'Direct Provider'}</div>
                           </div>
                           <div className="flex justify-between items-end border-t border-slate-50 pt-4 relative z-10">
                              <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">{fd(stack.items.length)} ITEMS</span>
                              <div className="text-right">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Batch Total</span>
                                 <span className="font-black text-xl text-slate-900 tracking-tighter tabular-nums">₹{stack.totalValue.toLocaleString()}</span>
                              </div>
                           </div>
                        </div>
                    ))
                )}
             </div>
          )}
       </div>

       {/* PO DETAIL MODAL */}
       {selectedPo && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center animate-fade-in">
              <div className="bg-white w-full rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedPo(null)} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={20}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none mb-1.5 truncate max-w-[200px]">{selectedPo.customerName || 'Purchase Order'}</h3>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(selectedPo.createdAt).toLocaleDateString()} • Order Draft</p>
                          </div>
                      </div>
                      <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                          selectedPo.status === TransactionStatus.PENDING ? 'bg-amber-100 text-amber-700' :
                          selectedPo.status === TransactionStatus.ORDERED ? 'bg-indigo-600 text-white shadow-lg' :
                          'bg-teal-600 text-white'
                      }`}>
                          {selectedPo.status}
                      </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-4">
                      {selectedPo.items.map((item, idx) => (
                        <div key={item.id} className="p-5 bg-slate-50/40 rounded-2xl border border-slate-100 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 pr-4">
                                    <div className="font-black text-slate-900 text-base uppercase leading-none mb-2">{item.partNumber}</div>
                                    <div className="flex items-center gap-3">
                                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Rate: ₹{item.price.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">Quantity</p>
                                    <p className="text-lg font-black text-slate-900 tabular-nums">{fd(item.quantity)}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-white pt-4">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Est. Subtotal</span>
                                <span className="font-black text-slate-900 text-base">₹{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        </div>
                      ))}
                  </div>
                  <div className="p-8 border-t border-slate-100 bg-white pb-safe">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                          <div className="flex flex-col w-full md:w-auto">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Valuation</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">₹{selectedPo.totalValue.toLocaleString()}</span>
                          </div>
                          
                          <div className="flex gap-3 w-full md:w-auto">
                            {selectedPo.status === TransactionStatus.PENDING && (
                                <button 
                                  onClick={() => handleOrderPo(selectedPo)} 
                                  disabled={loading}
                                  className="flex-1 md:flex-none px-8 py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Mark as Sent
                                </button>
                            )}
                            {selectedPo.status === TransactionStatus.ORDERED && (
                                <button 
                                  onClick={() => handleReceivePo(selectedPo)} 
                                  disabled={loading}
                                  className="flex-1 md:flex-none px-8 py-5 bg-teal-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-teal-100 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Inbox size={18}/>} Finalize Receipt
                                </button>
                            )}
                            <button onClick={() => setSelectedPo(null)} className="px-8 py-5 bg-slate-100 text-slate-500 font-black rounded-[1.5rem] active:scale-95 text-xs uppercase tracking-widest">Close</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
       )}

       {selectedInbound && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center animate-fade-in">
              <div className="bg-white w-full rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedInbound(null)} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-soft border border-slate-100 active:scale-90"><ArrowLeft size={20}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[200px]">{selectedInbound.customerName || 'Bulk Inbound'}</h3>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(selectedInbound.createdAt).toLocaleDateString()} • {new Date(selectedInbound.createdAt).toLocaleTimeString()}</p>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-3">
                      {selectedInbound.items.map((item, idx) => {
                          const partInfo = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
                          return (
                            <div key={item.id} className="p-5 bg-slate-50/40 rounded-2xl border border-slate-100 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 pr-4">
                                        <div className="font-black text-slate-900 text-base uppercase leading-none mb-1">{item.partNumber}</div>
                                        <div className="text-[12px] text-slate-900 font-bold uppercase tracking-tight mb-2">{partInfo?.name || 'MASTER PART RECORD'}</div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Rate: ₹{item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">Qty</p>
                                        <p className="text-lg font-black text-slate-900 tabular-nums">{fd(item.quantity)}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-white pt-4">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Item Subtotal</span>
                                    <span className="font-black text-slate-900 text-base">₹{(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                            </div>
                          );
                      })}
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-white pb-safe">
                      <div className="flex justify-between items-center mb-6">
                          <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acquisition Value</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{selectedInbound.totalValue.toLocaleString()}</span>
                          </div>
                          <button onClick={() => setSelectedInbound(null)} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl active:scale-95 text-[11px] uppercase tracking-widest">Close</button>
                      </div>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;
