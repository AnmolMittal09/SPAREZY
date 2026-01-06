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
  /* Added Search and RotateCcw to fix missing component errors */
  Search,
  RotateCcw
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

type PurchaseViewMode = 'STACKED' | 'LIST' | 'SUPPLIERS';

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

interface SupplierGroup {
  name: string;
  totalVolume: number;
  count: number;
  lastActive: string;
  transactions: Transaction[];
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'IMPORT' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<PurchaseViewMode>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierGroup | null>(null);
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

  const supplierGroups = useMemo(() => {
    const groups: Record<string, SupplierGroup> = {};
    history.forEach(tx => {
       const name = (tx.customerName || 'Standard Supplier').toUpperCase().trim();
       if (!groups[name]) groups[name] = { name, totalVolume: 0, count: 0, lastActive: tx.createdAt, transactions: [] };
       groups[name].totalVolume += (tx.price * tx.quantity);
       groups[name].count++;
       groups[name].transactions.push(tx);
       if (new Date(tx.createdAt) > new Date(groups[name].lastActive)) groups[name].lastActive = tx.createdAt;
    });
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [history]);

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
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>History</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={24} /></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Purchase Inbound</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbound Matrix & Audit Logs</p>
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

          {activeTab === 'HISTORY' && (
             <div className="bg-slate-50 md:bg-white md:rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-4 md:p-8 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                   <div className="flex items-center gap-5 w-full md:w-auto">
                      <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><History size={24} /></div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-[14px] uppercase tracking-wider leading-none mb-1.5">Acquisition Ledger</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl mt-1 w-fit">
                            <button onClick={() => setViewMode('STACKED')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400'}`}>Dates</button>
                            <button onClick={() => setViewMode('LIST')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400'}`}>Entries</button>
                            <button onClick={() => setViewMode('SUPPLIERS')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400'}`}>Suppliers</button>
                        </div>
                      </div>
                   </div>
                   <div className="flex gap-2 w-full md:w-auto px-1">
                      <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                         <input type="text" placeholder="Quick Search..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold shadow-inner-soft outline-none transition-all uppercase tracking-tight" />
                      </div>
                      <button onClick={loadHistory} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-soft"><RotateCcw size={20} className={loading ? 'animate-spin' : ''} /></button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
                   {loading ? <div className="flex justify-center p-12"><TharLoader /></div> : (
                      viewMode === 'SUPPLIERS' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {supplierGroups.map(supplier => (
                             <div 
                               key={supplier.name} 
                               onClick={() => setSelectedSupplier(supplier)}
                               className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-100 shadow-soft active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden"
                             >
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                   <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:rotate-6 transition-transform">
                                      <Truck size={26} strokeWidth={2.5} />
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 opacity-70">Total Acquisition</p>
                                      <p className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">₹{supplier.totalVolume.toLocaleString()}</p>
                                   </div>
                                </div>
                                <div className="mb-8 relative z-10 px-1">
                                   <h3 className="font-black text-[18px] text-slate-900 uppercase tracking-tight leading-tight truncate pr-6 group-hover:text-blue-600 transition-colors">{supplier.name}</h3>
                                   <div className="flex items-center gap-3 mt-3">
                                      <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-xl shadow-inner border border-brand-100 uppercase tracking-widest">{fd(supplier.count)} Batch Logs</span>
                                   </div>
                                </div>
                                <div className="pt-6 border-t border-slate-100 flex items-center justify-between relative z-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                   <span>Last Batch: {new Date(supplier.lastActive).toLocaleDateString()}</span>
                                   <ChevronRight size={18} className="text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                                </div>
                             </div>
                           ))}
                        </div>
                      ) : viewMode === 'STACKED' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {stackedHistory.map(stack => (
                              <div key={stack.id} onClick={() => setSelectedInbound(stack)} className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-100 shadow-soft active:scale-[0.98] transition-all cursor-pointer group animate-fade-in">
                                 <div className="flex justify-between items-start mb-8">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Calendar size={20}/></div>
                                    <div className="text-right">
                                       <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">INBOUND TIMESTAMP</span>
                                       <span className="text-[14px] font-black text-slate-900">{new Date(stack.createdAt).toLocaleDateString()}</span>
                                    </div>
                                 </div>
                                 <div className="mb-8 px-1">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-2 opacity-60">DEALER PROFILE</span>
                                    <div className="font-black text-xl text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">{stack.customerName || 'Main Provider'}</div>
                                 </div>
                                 <div className="flex justify-between items-end border-t border-slate-50 pt-6">
                                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3 shadow-inner-soft">
                                       <Package size={16} className="text-slate-400"/>
                                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{fd(stack.items.length)} UNITS</span>
                                    </div>
                                    <div className="text-right">
                                       <p className="font-black text-2xl text-slate-900 tracking-tighter tabular-nums leading-none">₹{stack.totalValue.toLocaleString()}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {history.map(tx => (
                              <div key={tx.id} className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-soft animate-fade-in group hover:border-blue-200 transition-all">
                                 <div className="flex justify-between items-start mb-5">
                                    <div className="space-y-1">
                                       <div className="font-black text-slate-900 text-lg uppercase tracking-tight group-hover:text-blue-600 transition-colors">{tx.partNumber}</div>
                                       <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5"><Calendar size={12}/> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[8px] font-black uppercase tracking-widest border border-blue-100">BATCH #{fd(tx.quantity)}</div>
                                 </div>
                                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl text-slate-400 shadow-inner border border-slate-200"><Users size={16}/></div>
                                    <span className="text-[11px] font-black text-slate-800 uppercase truncate tracking-tight">{tx.customerName || 'Main Provider'}</span>
                                 </div>
                                 <div className="flex justify-between items-end border-t border-slate-50 pt-5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal Assets</span>
                                    <div className="text-right">
                                       <p className="text-xl font-black text-slate-900 tabular-nums tracking-tighter leading-none">₹{(tx.price * tx.quantity).toLocaleString()}</p>
                                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">@ ₹{tx.price.toLocaleString()}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                      )
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
                              <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[200px] tracking-tight">{selectedInbound.customerName}</h3>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{new Date(selectedInbound.createdAt).toLocaleDateString()} • {new Date(selectedInbound.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-4 bg-slate-50/30 pb-24">
                      {selectedInbound.items.map((item, idx) => (
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

       {selectedSupplier && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in md:p-10 no-scrollbar">
              <div className="bg-white w-full max-w-5xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl flex flex-col h-[95vh] overflow-hidden animate-slide-up pb-safe no-scrollbar">
                  <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/40 gap-6">
                      <div className="flex items-center gap-6">
                          <button onClick={() => setSelectedSupplier(null)} className="p-3.5 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={24} strokeWidth={3}/></button>
                          <div className="min-w-0">
                              <h3 className="font-black text-slate-900 text-2xl md:text-3xl tracking-tighter leading-none mb-2 uppercase truncate max-w-[300px]">{selectedSupplier.name}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                                  <Clock size={14} className="opacity-50"/> Last Active: {new Date(selectedSupplier.lastActive).toLocaleDateString()}
                              </div>
                          </div>
                      </div>
                      <div className="text-right bg-white px-8 py-5 rounded-[2rem] border border-slate-100 shadow-soft">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70">Station Acquisition Value</p>
                        <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter tabular-nums">₹{selectedSupplier.totalVolume.toLocaleString()}</p>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-10 no-scrollbar space-y-6 pb-24">
                      {selectedSupplier.transactions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(tx => (
                        <div key={tx.id} className="p-7 border-2 border-slate-100 rounded-[2.5rem] bg-white shadow-soft hover:shadow-premium transition-all group/item">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6 min-w-0 flex-1">
                                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner-soft group-hover/item:text-blue-500 transition-colors"><Package size={22} strokeWidth={2.5}/></div>
                                   <div className="min-w-0 flex-1">
                                      <p className="font-black text-slate-900 text-lg md:text-xl uppercase tracking-tight truncate leading-tight group-hover/item:text-blue-600 transition-colors">{tx.partNumber}</p>
                                      <div className="flex items-center gap-3 mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                         <Calendar size={12}/> {new Date(tx.createdAt).toLocaleDateString()} <span className="opacity-30">•</span> {fd(tx.quantity)} Units Added
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right self-end md:self-center border-l border-slate-50 pl-8 md:pl-12">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">BATCH NET</p>
                                   <p className="font-black text-2xl tabular-nums tracking-tighter leading-none text-slate-900">₹{(tx.price * tx.quantity).toLocaleString()}</p>
                                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 block">@ ₹{tx.price.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                      ))}
                  </div>
                  <div className="p-10 border-t border-slate-100 bg-white flex justify-end shadow-2xl">
                      <button onClick={() => setSelectedSupplier(null)} className="w-full md:w-auto px-16 py-6 bg-slate-900 text-white font-black rounded-[2rem] active:scale-[0.98] transition-all text-sm uppercase tracking-[0.25em] shadow-xl border border-white/10">Release Session</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;