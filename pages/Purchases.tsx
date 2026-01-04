import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Brand } from '../types';
import DailyTransactions from './DailyTransactions';
import { 
  History, 
  PlusCircle, 
  PackageCheck, 
  FileUp, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  FileSpreadsheet,
  Info,
  ArrowRight,
  TrendingUp,
  Calendar,
  Truck,
  Clock,
  ChevronRight,
  Database,
  FileText,
  ScanLine,
  Share2,
  MessageCircle,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Percent,
  Building2,
  Layers,
  List,
  ArrowLeft,
  Package,
  ArrowUpDown,
  Plus,
  Trash2,
  Image as ImageIcon,
  Edit3,
  Zap,
  Check
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
  const [viewMode, setViewMode] = useState<'STACKED' | 'LIST'>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  
  // Multi-page queue
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  
  // Sort for History
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);

  // Bulk Import State
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ success: boolean; message: string; count: number; totalValue: number; errorCount: number; addedCount?: number; updatedCount?: number; dealer?: string } | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<{ dealerName?: string; invoiceDate?: string }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const STANDARD_DISCOUNT = 12;

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
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

  const sortedListHistory = useMemo(() => {
    const res = [...history];
    res.sort((a, b) => {
       const timeA = new Date(a.createdAt).getTime();
       const timeB = new Date(b.createdAt).getTime();
       return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return res;
  }, [history, sortOrder]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newQueued: QueuedFile[] = [];
    Array.from(files).forEach(f => {
      newQueued.push({
        id: Math.random().toString(36).substring(7),
        file: f,
        preview: URL.createObjectURL(f)
      });
    });

    setQueuedFiles(prev => [...prev, ...newQueued]);
    e.target.value = ''; // Reset input
  };

  const removeFileFromQueue = (id: string) => {
    setQueuedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleEditPartNumber = (index: number, newVal: string) => {
    setPreviewData(prev => prev.map((item, idx) => 
        idx === index ? { ...item, partNumber: newVal.toUpperCase().trim() } : item
    ));
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
        // Handle Excel
        const data = await excelFile.file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!jsonData || jsonData.length < 1) throw new Error("Spreadsheet is empty.");

        const parsed = jsonData.slice(1).map(row => {
          const mrp = Number(row[2] || 0);
          const disc = Number(row[3] || 0);
          const printed = Number(row[4] || mrp * (1 - disc/100));
          const calculatedAt12 = mrp * (1 - (STANDARD_DISCOUNT/100));
          
          let hasError = false;
          let errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE' = 'NONE';
          if (disc < STANDARD_DISCOUNT) { hasError = true; errorType = 'DISCOUNT_LOW'; } 
          else if (Math.abs(printed - calculatedAt12) > 0.5) { hasError = true; errorType = 'CALC_MISMATCH'; }

          return {
            partNumber: String(row[0] || '').toUpperCase().trim(),
            name: String(row[1] || 'Excel Row'),
            quantity: Number(row[5] || 1),
            mrp, discountPercent: disc, printedUnitPrice: printed, calculatedPrice: calculatedAt12, hasError, errorType, diff: printed - calculatedAt12
          };
        }).filter(i => i.partNumber && i.quantity > 0);
        
        setPreviewData(parsed as any);
      } else {
        // Multi-page Image/PDF Logic
        const payload: InvoiceFile[] = [];
        for (const q of queuedFiles) {
          const base64 = await fileToBase64(q.file);
          payload.push({ data: base64, mimeType: q.file.type });
        }

        const result = await extractInvoiceData(payload);
        
        if (result && result.items && result.items.length > 0) {
          setExtractedMetadata({ dealerName: result.dealerName, invoiceDate: result.invoiceDate });
          
          const verifiedItems = result.items.map((item: any) => {
            const expectedPriceAt12Percent = item.mrp * (1 - (STANDARD_DISCOUNT / 100));
            const diff = Math.abs(expectedPriceAt12Percent - item.printedUnitPrice);
            let hasError = false;
            let errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE' = 'NONE';
            if (item.discountPercent < STANDARD_DISCOUNT) { hasError = true; errorType = 'DISCOUNT_LOW'; } 
            else if (diff > 0.5) { hasError = true; errorType = 'CALC_MISMATCH'; }

            return {
              ...item,
              partNumber: item.partNumber.toUpperCase().trim(),
              calculatedPrice: parseFloat(expectedPriceAt12Percent.toFixed(2)),
              hasError, errorType,
              diff: parseFloat((item.printedUnitPrice - expectedPriceAt12Percent).toFixed(2))
            };
          });
          setPreviewData(verifiedItems);
        } else {
          throw new Error("No items detected in invoice.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Extraction failed.");
    } finally {
      setImporting(false);
    }
  };

  const confirmBulkImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);

    const sourceName = extractedMetadata.dealerName 
      ? `${extractedMetadata.dealerName} (Inv: ${extractedMetadata.invoiceDate || 'N/A'})`
      : `AI Scan (${new Date().toLocaleDateString()})`;

    try {
        // 1. Sync to Inventory (Handles adding new parts automatically)
        const inventoryPayload = previewData.map(item => {
            const existing = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
            return {
                partNumber: item.partNumber,
                name: item.name,
                price: item.mrp, // Store MRP as price
                quantity: (existing?.quantity || 0) + item.quantity, // Increment current quantity
                brand: item.partNumber.startsWith('HY') ? Brand.HYUNDAI : item.partNumber.startsWith('MH') ? Brand.MAHINDRA : undefined
            };
        });

        const syncRes = await updateOrAddItems(inventoryPayload, { 
            fileName: `Bill: ${sourceName}`, 
            mode: 'AI_AUDIT_PURCHASE' 
        });

        if (syncRes.errors.length > 0 && syncRes.added === 0 && syncRes.updated === 0) {
            throw new Error(syncRes.errors[0]);
        }

        // 2. Log Transactions for history trail
        const txPayload = previewData.map(item => ({
            partNumber: item.partNumber,
            type: TransactionType.PURCHASE,
            quantity: item.quantity,
            price: item.printedUnitPrice,
            customerName: sourceName,
            createdByRole: user.role
        }));

        await createBulkTransactions(txPayload);

        const totalValue = txPayload.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const errorCount = previewData.filter(i => i.hasError).length;

        setImportLog({ 
            success: true, 
            message: "Purchase Audit Successful.", 
            count: previewData.length,
            totalValue: totalValue,
            errorCount,
            addedCount: syncRes.added,
            updatedCount: syncRes.updated,
            dealer: extractedMetadata.dealerName
        });
        setPreviewData([]);
        setQueuedFiles([]);
    } catch (err: any) {
        setImportLog({ success: false, message: err.message || "Process failed.", count: 0, totalValue: 0, errorCount: 0 });
    } finally {
      setImporting(false);
      fetchInventory().then(setInventory);
    }
  };

  const shareToWhatsApp = () => {
    if (!importLog) return;
    const summary = `🚀 *Sparezy Inbound Verification*\n\n` +
      `🏢 *Dealer:* ${importLog.dealer || 'Unknown'}\n` +
      `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
      `📦 *Items:* ${importLog.count}\n` +
      `🆕 *New SKUs:* ${importLog.addedCount}\n` +
      `💰 *Total:* ₹${importLog.totalValue.toLocaleString()}\n` +
      `⚠️ *Discrepancies:* ${importLog.errorCount === 0 ? 'None (Verified ✅)' : importLog.errorCount + ' Issues Found 🚨'}\n\n` +
      `_Automated AI audit and inventory sync completed._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] md:bg-transparent">
       
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-soft animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`}>Entry</button>
               <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-3d' : 'text-slate-400'}`}>Scan</button>
               <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`}>Log</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-10 px-1">
          <div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">Purchase Inbound</h1>
             <p className="text-slate-500 font-medium mt-1">Scan documents to audit 12% B.DC compliance.</p>
          </div>
          <div className="flex bg-white p-2 rounded-3xl border border-slate-200 shadow-3d">
             <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`px-8 py-3 text-sm font-black rounded-2xl transition-all flex items-center gap-3 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={20} /> Manual</button>
             <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`px-8 py-3 text-sm font-black rounded-2xl transition-all flex items-center gap-3 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={20} /> AI Scan</button>
             <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`px-8 py-3 text-sm font-black rounded-2xl transition-all flex items-center gap-3 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><History size={20} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col h-full overflow-y-auto no-scrollbar pb-40">
                {!previewData.length && !importLog && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-4xl p-8 flex gap-6 items-start shadow-3d">
                        <div className="p-5 bg-blue-600 text-white rounded-3xl shadow-3d flex-none transform rotate-3"><Calculator size={32} /></div>
                        <div>
                            <h3 className="font-black text-blue-900 text-xl uppercase tracking-tight">Smart Bill Verification</h3>
                            <p className="text-[15px] text-blue-700/80 mt-3 leading-relaxed font-bold">
                                Upload multi-page bills. Sparezy will audit every line for <b>12% B.DC</b> rule compliance and auto-sync with inventory.
                            </p>
                        </div>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-3d">
                        <div className="flex justify-between items-center mb-8">
                           <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Scanning Queue ({queuedFiles.length} Pages)</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-500 font-black text-[10px] uppercase tracking-widest hover:underline px-3 py-1.5 bg-rose-50 rounded-lg">Clear All</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-3xl overflow-hidden border-2 border-slate-100 shadow-3d bg-slate-50 card-3d">
                                {q.file.type.startsWith('image/') ? (
                                  <img src={q.preview} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                     <FileText size={40} />
                                     <span className="text-[9px] font-black uppercase mt-3 px-3 text-center truncate w-full">{q.file.name}</span>
                                  </div>
                                )}
                                <button 
                                  onClick={() => removeFileFromQueue(q.id)}
                                  className="absolute top-3 right-3 p-2 bg-rose-600 text-white rounded-xl shadow-3d opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                   <p className="text-white text-[10px] font-black truncate uppercase tracking-widest">Page {queuedFiles.indexOf(q) + 1}</p>
                                </div>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 hover:bg-slate-50 hover:text-blue-400 hover:border-blue-200 cursor-pointer transition-all active:scale-95 group">
                              <Plus size={32} className="group-hover:scale-125 transition-transform" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] mt-3">Add Page</span>
                              <input type="file" multiple accept="application/pdf, image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        
                        <div className="mt-10 border-t border-slate-50 pt-8">
                          <button 
                            onClick={startAiAudit}
                            disabled={importing}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-3xl shadow-3d flex items-center justify-center gap-4 active:scale-95 transition-all text-lg uppercase tracking-widest"
                          >
                            {importing ? <Loader2 className="animate-spin" /> : <ScanLine size={24} />}
                            {importing ? 'AI Analysis...' : 'Start Audit Analysis'}
                          </button>
                        </div>
                      </div>
                    )}

                    {queuedFiles.length === 0 && (
                      <div className="bg-white border-4 border-dashed border-slate-100 rounded-4xl p-16 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all group shadow-inner">
                        <div className="w-28 h-28 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-10 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-3d transform group-hover:rotate-12"><ImageIcon size={52} /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Import Invoice</h2>
                        <p className="text-slate-400 mb-12 max-w-xs mx-auto text-base font-bold">PDF, Clear Images, or Excel sheets supported</p>
                        <label className="inline-flex items-center gap-4 bg-blue-600 hover:bg-blue-700 text-white font-black px-14 py-6 rounded-3xl cursor-pointer transition-all active:scale-95 shadow-3d uppercase text-[15px] tracking-[0.15em]">
                           <Upload size={28} /> Select Documents
                           <input type="file" multiple accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    )}
                    
                    {errorMsg && <div className="mt-12 p-6 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 text-sm font-black flex items-center gap-4 justify-center animate-shake shadow-soft"><AlertCircle size={24} /> {errorMsg}</div>}
                  </div>
                )}

                {importLog && (
                  <div className={`p-12 rounded-4xl border-2 flex flex-col items-center text-center animate-slide-up shadow-3d bg-white ${importLog.success ? 'border-teal-100' : 'border-rose-100'}`}>
                      <div className={`w-28 h-28 rounded-full mb-10 flex items-center justify-center shadow-3d ${importLog.success ? 'bg-teal-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {importLog.success ? <CheckCircle2 size={56} /> : <AlertCircle size={56} />}
                      </div>
                      <h3 className={`text-4xl font-black ${importLog.success ? 'text-slate-900' : 'text-rose-900'}`}>
                        {importLog.success ? 'Audit Finished' : 'Analysis Failed'}
                      </h3>
                      <p className="mt-6 font-bold text-slate-400 text-lg max-w-sm leading-relaxed">
                         {importLog.success 
                            ? `Successfully verified ${importLog.count} parts. ${importLog.addedCount || 0} items newly cataloged.` 
                            : importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-14 space-y-6 w-full">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner-3d">
                                    <span className="block text-3xl font-black text-slate-900">{importLog.count}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 block">Total SKUs</span>
                                </div>
                                <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100 shadow-inner-3d">
                                    <span className="block text-3xl font-black text-teal-600">{importLog.addedCount}</span>
                                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest mt-2 block">New Parts</span>
                                </div>
                                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 shadow-inner-3d">
                                    <span className="block text-2xl font-black text-blue-900">₹{(importLog.totalValue / 1000).toFixed(1)}k</span>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2 block">Valuation</span>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button onClick={shareToWhatsApp} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-black py-6 rounded-3xl shadow-3d flex items-center justify-center gap-4 transition-all active:scale-95"><MessageCircle size={28} /> Share Report</button>
                                <button onClick={() => setActiveTab('HISTORY')} className="bg-slate-900 text-white p-6 rounded-3xl shadow-3d transition-all active:scale-95"><History size={28} /></button>
                            </div>
                        </div>
                      )}
                      <button onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); setQueuedFiles([]); }} className="mt-16 text-[12px] font-black text-slate-300 uppercase tracking-[0.4em] hover:text-brand-600 transition-colors">Audit Next Document</button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-4xl shadow-3d border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[88vh]">
                     <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-xl">
                        <div className="flex items-center gap-5">
                           <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-3d"><ShieldCheck size={32} /></div>
                           <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2">Audit Verification</h3>
                              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.25em]">Source: {extractedMetadata.dealerName || 'Unknown Vendor'}</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-3 text-slate-300 hover:text-rose-500 bg-white border border-slate-50 rounded-2xl shadow-soft transition-all active:scale-90"><X size={24} /></button>
                     </div>

                     <div className="bg-amber-50 p-5 border-b border-amber-100 flex items-start gap-4">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-none"><Zap size={20} /></div>
                        <p className="text-[11px] font-black text-amber-800 leading-relaxed uppercase tracking-wide py-1">Review part numbers below. Pulsing tags highlight **New Inventory** that will be added automatically.</p>
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar bg-slate-50/50">
                        {previewData.map((row, i) => {
                           const exists = inventory.some(item => item.partNumber.toLowerCase() === row.partNumber.toLowerCase());
                           return (
                               <div key={i} className={`bg-white p-6 md:p-8 rounded-4xl border shadow-3d flex flex-col gap-6 animate-fade-in transition-all relative overflow-hidden card-3d ${row.hasError ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="flex flex-col gap-5">
                                    
                                    {/* Mobile Responsive Header for Card */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                       <div className="w-full flex-1 space-y-2">
                                          <div className="flex items-center justify-between mb-1">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Part Number (Editable)</label>
                                              {!exists && (
                                                <span className="sm:hidden flex-none bg-teal-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase shadow-3d animate-pulse flex items-center gap-1.5">
                                                   <Plus size={10} strokeWidth={4} /> NEW SKU
                                                </span>
                                              )}
                                          </div>
                                          <div className="relative group/edit">
                                             <input 
                                                type="text"
                                                value={row.partNumber}
                                                onChange={e => handleEditPartNumber(i, e.target.value)}
                                                className="w-full bg-slate-50/50 px-5 py-4.5 pr-14 rounded-3xl border-2 border-slate-100 font-black text-slate-900 text-[18px] md:text-2xl leading-tight tracking-tight focus:bg-white focus:border-blue-500 focus:ring-[12px] focus:ring-blue-500/10 transition-all outline-none shadow-inner-3d"
                                             />
                                             <Edit3 size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within/edit:text-blue-500" />
                                          </div>
                                       </div>
                                       
                                       <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 sm:pt-6">
                                          {!exists && (
                                            <span className="hidden sm:flex flex-none bg-teal-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-3d animate-pulse items-center gap-2">
                                               <Plus size={12} strokeWidth={4} /> NEW SKU
                                            </span>
                                          )}
                                          <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl text-[13px] font-black uppercase shadow-3d flex items-center gap-2 whitespace-nowrap min-w-[100px] justify-center">
                                             <Check size={18} strokeWidth={3} /> {row.quantity} QTY
                                          </div>
                                       </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 px-2">
                                       <div className="text-[14px] md:text-[16px] text-slate-400 font-black truncate flex-1 uppercase tracking-tight">{row.name}</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3 md:gap-6 pt-6 border-t border-slate-100">
                                    <div className="bg-slate-50 p-3 md:p-5 rounded-3xl border border-slate-100 shadow-inner-3d">
                                        <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">MRP</p>
                                        <p className="font-black text-slate-900 text-sm md:text-xl">₹{row.mrp.toLocaleString()}</p>
                                    </div>
                                    <div className={`p-3 md:p-5 rounded-3xl border shadow-inner-3d ${row.errorType === 'DISCOUNT_LOW' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">B.DC</p>
                                        <p className={`font-black text-sm md:text-xl ${row.errorType === 'DISCOUNT_LOW' ? 'text-rose-600' : 'text-slate-900'}`}>
                                          {row.discountPercent}%
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-3 md:p-5 rounded-3xl border border-blue-100 text-right shadow-inner-3d">
                                        <p className="text-[9px] md:text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Net Unit</p>
                                        <p className="font-black text-blue-700 text-sm md:text-xl">₹{row.printedUnitPrice.toLocaleString()}</p>
                                    </div>
                                </div>

                                {row.hasError && (
                                    <div className="bg-rose-600 text-white p-4 md:p-5 rounded-3xl shadow-3d flex gap-4 items-center animate-slide-up">
                                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-none"><AlertTriangle size={24} /></div>
                                        <div className="text-[11px] md:text-[13px] font-black leading-tight uppercase tracking-[0.1em]">
                                          {row.errorType === 'DISCOUNT_LOW' ? (
                                              <p>Audit Alert: B.DC is below 12% Shop Standard!</p>
                                          ) : (
                                              <p>Math Alert: Expected ₹{row.calculatedPrice.toLocaleString()} at 12% B.DC.</p>
                                          )}
                                        </div>
                                    </div>
                                )}
                            </div>
                           );
                        })}
                     </div>

                     <div className="p-8 md:p-12 border-t border-slate-100 bg-white sticky bottom-0 z-10 shadow-[0_-30px_60px_rgba(0,0,0,0.08)]">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-7 md:py-8 rounded-4xl shadow-3d flex items-center justify-center gap-6 active:scale-[0.98] transition-all disabled:opacity-50 text-[18px] md:text-[22px] uppercase tracking-[0.2em]">
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={32} />} Confirm & Sync Audit
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white md:rounded-4xl shadow-3d border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-xl flex flex-col lg:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-5">
                      <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-3d transform -rotate-2"><Truck size={32} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-2xl tracking-tighter block uppercase">Inbound Journal</span>
                         <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Stock Acquisition History</span>
                      </div>
                      <div className="ml-6 flex bg-slate-100 p-1.5 rounded-2xl shadow-inner-3d">
                          <button onClick={() => setViewMode('STACKED')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`} title="Bill Stack View"><Layers size={20} /></button>
                          <button onClick={() => setViewMode('LIST')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`} title="Item List View"><List size={20} /></button>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')} className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-white hover:shadow-premium active:scale-95 transition-all border border-slate-100"><ArrowUpDown size={24} /></button>
                      <button onClick={loadHistory} className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-white hover:shadow-premium active:scale-95 transition-all border border-slate-100"><Clock size={24} /></button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-6 no-scrollbar pb-40">
                  {loading ? <div className="flex justify-center p-32"><TharLoader /></div> : history.length === 0 ? <div className="flex flex-col items-center justify-center py-40 text-slate-200"><div className="w-32 h-32 bg-white rounded-4xl flex items-center justify-center mb-10 shadow-3d"><History size={64} className="opacity-10" /></div><p className="font-black text-[14px] uppercase tracking-[0.5em]">No Journal Entries</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {viewMode === 'STACKED' ? (
                          stackedHistory.map(stack => (
                            <div 
                              key={stack.id} 
                              onClick={() => setSelectedInbound(stack)}
                              className="p-8 bg-white rounded-4xl border-2 border-slate-100 shadow-3d hover:border-blue-300 hover:shadow-3d-hover transition-all cursor-pointer group relative animate-fade-in card-3d"
                            >
                                <div className="absolute -bottom-3 left-10 right-10 h-3 bg-blue-100 rounded-b-4xl -z-10 group-hover:-bottom-4 transition-all opacity-50"></div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><FileText size={20}/></div>
                                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">AUDITED BILL</span>
                                        </div>
                                        <div className="text-[12px] font-bold text-slate-400 flex items-center gap-3">
                                            <Calendar size={14}/> {new Date(stack.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">|</span>
                                            <Clock size={14}/> {new Date(stack.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-3d active:scale-90 transition-all">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                                <div className="mb-8">
                                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.25em] mb-2">Dealer / Vendor</p>
                                    <div className="font-black text-xl text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                                        {stack.customerName || 'Bulk Manual Entry'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-100 pt-6 mt-auto">
                                    <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-inner-3d">
                                        <Package size={18} className="text-slate-400"/>
                                        <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">{stack.items.length} SKUs</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Stock Value</p>
                                        <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                            ₹{stack.totalValue.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                          ))
                        ) : (
                          sortedListHistory.map(tx => (
                            <div key={tx.id} className="p-8 bg-white rounded-4xl border border-slate-100 shadow-3d animate-fade-in relative group overflow-hidden card-3d">
                                <div className="absolute top-0 right-0 w-4 h-full bg-blue-600/10 group-hover:bg-blue-600/20 transition-all"></div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-2 flex-1 min-w-0 pr-6">
                                        <div className="font-black text-slate-900 text-2xl leading-tight tracking-tight truncate uppercase">{tx.partNumber}</div>
                                        <div className="flex items-center gap-3 text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]"><Calendar size={14} className="text-slate-200" /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl text-[12px] font-black uppercase tracking-[0.1em] shadow-inner-3d">+{tx.quantity}</div>
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-end">
                                    <div className="flex-1 min-w-0 pr-6"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Dealer</p><p className="text-[15px] font-black text-slate-700 truncate">{tx.customerName || 'Manual Entry'}</p></div>
                                    <div className="text-right"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Audit Rate</p><p className="text-2xl font-black text-slate-900 tracking-tighter">₹{tx.price.toLocaleString()}</p></div>
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

       {/* INBOUND DETAIL MODAL */}
       {selectedInbound && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12 animate-fade-in">
              <div className="bg-white w-full max-w-5xl rounded-4xl shadow-3d-hover flex flex-col max-h-[92vh] overflow-hidden animate-slide-up border border-white/20">
                  <div className="p-8 md:p-12 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-xl">
                      <div className="flex items-center gap-6">
                          <button onClick={() => setSelectedInbound(null)} className="p-4 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-3d border border-slate-100 transition-all active:scale-90"><ArrowLeft size={28}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-3xl tracking-tighter leading-none mb-3">{selectedInbound.customerName || 'Bulk Inbound'}</h3>
                              <div className="flex items-center gap-4 text-slate-400 text-[14px] font-black uppercase tracking-[0.2em]">
                                  <Calendar size={18} strokeWidth={3}/> {new Date(selectedInbound.createdAt).toLocaleDateString()}
                                  <span className="text-slate-200">|</span>
                                  <Clock size={18} strokeWidth={3}/> {new Date(selectedInbound.createdAt).toLocaleTimeString()}
                              </div>
                          </div>
                      </div>
                      <div className="hidden md:block px-8 py-3.5 rounded-2xl text-[14px] font-black uppercase tracking-[0.25em] bg-blue-50 text-blue-600 shadow-inner-3d">
                          INVENTORY AUDIT
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar space-y-6 bg-slate-50/30">
                      <div className="flex items-center gap-4 mb-6">
                         <div className="w-2.5 h-10 bg-blue-600 rounded-full shadow-3d"></div>
                         <h4 className="font-black text-slate-900 uppercase tracking-[0.3em] text-sm">Line Items Verified ({selectedInbound.items.length})</h4>
                      </div>
                      <div className="space-y-4">
                          {selectedInbound.items.map((item, idx) => (
                              <div key={item.id} className="p-8 bg-white rounded-4xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-blue-200 hover:shadow-3d transition-all card-3d">
                                  <div className="flex items-center gap-6">
                                      <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center font-black text-slate-300 text-lg shadow-inner-3d">{idx + 1}</div>
                                      <div className="min-w-0">
                                          <div className="font-black text-slate-900 text-2xl leading-tight tracking-tight group-hover:text-blue-600 transition-colors uppercase">{item.partNumber}</div>
                                          <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Verified Rate: ₹{item.price.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-14 border-t md:border-t-0 border-slate-100 pt-6 md:pt-0">
                                      <div className="text-center md:text-right">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Quantity</p>
                                          <p className="text-2xl font-black text-slate-900">{item.quantity}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Line Total</p>
                                          <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-10 md:p-12 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center gap-6">
                          <div className="p-6 bg-blue-600 text-white rounded-3xl shadow-3d transform -rotate-3"><Database size={40} /></div>
                          <div>
                              <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Total Inbound Valuation</p>
                              <p className="text-5xl font-black text-slate-900 tracking-tighter">₹{selectedInbound.totalValue.toLocaleString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedInbound(null)} className="w-full md:w-auto bg-slate-900 hover:bg-black text-white font-black px-16 py-7 rounded-3xl transition-all active:scale-95 uppercase text-[15px] tracking-[0.3em] shadow-3d">Close Log View</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;