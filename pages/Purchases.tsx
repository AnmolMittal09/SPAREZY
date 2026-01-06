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
  // Removed viewMode state as per user request to simplify and show "direct supplier name tab"
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

  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    const q = historySearch.toLowerCase();
    return history.filter(tx => 
      tx.partNumber.toLowerCase().includes(q) || 
      tx.customerName.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  const stackedHistory = useMemo(() => {
    const groups: Record<string, GroupedInbound> = {};
    filteredHistory.forEach(tx => {
       // We group by createdAt and customerName to separate unique invoice/scan batches
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
                      <div className="relative flex-1 md:w-72">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {stackedHistory.length === 0 ? (
                             <div className="col-span-full py-40 text-center text-slate-200 flex flex-col items-center justify-center">
                                <History size={64} className="opacity-10 mb-6" />
                                <p className="font-black uppercase tracking-[0.3em] text-slate-300">Journal Clear</p>
                             </div>
                           ) : (
                             stackedHistory.map(stack => (
                                <div key={stack.id} onClick={() => setSelectedInbound(stack)} className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-100 shadow-soft active:scale-[0.98] transition-all cursor-pointer group animate-fade-in relative overflow-hidden">
                                   <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/[0.03] rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
                                   
                                   <div className="flex justify-between items-start mb-8 relative z-10">
                                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner border border-blue-100/50"><Truck size={20} strokeWidth={2.5}/></div>
                                      <div className="text-right">
                                         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">INBOUND TIMESTAMP</span>
                                         <div className="flex items-center justify-end gap-2">
                                            <Calendar size={12} className="text-blue-400" />
                                            <span className="text-[14px] font-black text-slate-900 tracking-tight">{new Date(stack.createdAt).toLocaleDateString()}</span>
                                         </div>
                                      </div>
                                   </div>

                                   <div className="mb-8 px-1 relative z-10">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-2 opacity-60">DEALER IDENTITY</span>
                                      <div className="font-black text-xl text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                         {stack.customerName || 'Main Provider'}
                                      </div>
                                   </div>

                                   <div className="flex justify-between items-end border-t border-slate-50 pt-6 relative z-10">
                                      <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3 shadow-inner-soft">
                                         <Package size={16} className="text-slate-400"/>
                                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{fd(stack.items.length)} ASSETS</span>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">BATCH VALUE</p>
                                         <p className="font-black text-2xl text-slate-900 tracking-tighter tabular-nums leading-none">₹{stack.totalValue.toLocaleString()}</p>
                                      </div>
                                   </div>
                                </div>
                             ))
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
                              <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[250px] tracking-tight">{selectedInbound.customerName}</h3>
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