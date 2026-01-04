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
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Entry</button>
               <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>Scan</button>
               <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Log</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Purchase Inbound</h1>
             <p className="text-slate-500 font-medium">Scan documents to audit 12% B.DC compliance.</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={18} /> Manual</button>
             <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={18} /> AI Scan</button>
             <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><History size={18} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col h-full overflow-y-auto no-scrollbar pb-32">
                {!previewData.length && !importLog && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8 flex gap-5 items-start shadow-sm">
                        <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-100 flex-none"><Calculator size={28} /></div>
                        <div>
                            <h3 className="font-black text-blue-900 text-lg uppercase tracking-tight">Smart Document Processing</h3>
                            <p className="text-[14px] text-blue-700/80 mt-2 leading-relaxed font-medium">
                                Upload multi-page bills. Sparezy will audit every line for <b>12% B.DC</b> rule compliance and auto-sync with inventory.
                            </p>
                        </div>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-soft">
                        <div className="flex justify-between items-center mb-6">
                           <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Scanning Queue ({queuedFiles.length} Pages)</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-500 font-black text-[10px] uppercase tracking-widest hover:underline">Clear Queue</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50">
                                {q.file.type.startsWith('image/') ? (
                                  <img src={q.preview} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                     <FileText size={32} />
                                     <span className="text-[8px] font-black uppercase mt-2 px-2 text-center truncate w-full">{q.file.name}</span>
                                  </div>
                                )}
                                <button 
                                  onClick={() => removeFileFromQueue(q.id)}
                                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                   <p className="text-white text-[9px] font-bold truncate">Page {queuedFiles.indexOf(q) + 1}</p>
                                </div>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer transition-all active:scale-95">
                              <Plus size={24} />
                              <span className="text-[10px] font-black uppercase tracking-widest mt-1">Add Page</span>
                              <input type="file" multiple accept="application/pdf, image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        
                        <div className="mt-8 border-t border-slate-50 pt-6">
                          <button 
                            onClick={startAiAudit}
                            disabled={importing}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                          >
                            {importing ? <Loader2 className="animate-spin" /> : <ScanLine size={20} />}
                            {importing ? 'Extracting Data...' : 'Start Audit Analysis'}
                          </button>
                        </div>
                      </div>
                    )}

                    {queuedFiles.length === 0 && (
                      <div className="bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-12 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all group shadow-soft">
                        <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner"><ImageIcon size={44} /></div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Import Invoice</h2>
                        <p className="text-slate-400 mb-10 max-w-xs mx-auto text-[14px] font-bold">PDF / Images / Excel supported</p>
                        <label className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-2xl shadow-blue-200 uppercase text-[13px] tracking-widest">
                           <Upload size={24} /> Select Documents
                           <input type="file" multiple accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    )}
                    
                    {errorMsg && <div className="mt-10 p-5 bg-red-50 text-red-600 rounded-3xl border border-red-100 text-sm font-black flex items-center gap-3 justify-center animate-shake"><AlertCircle size={20} /> {errorMsg}</div>}
                  </div>
                )}

                {importLog && (
                  <div className={`p-10 rounded-[3rem] border-2 flex flex-col items-center text-center animate-slide-up shadow-2xl bg-white ${importLog.success ? 'border-green-100' : 'border-red-100'}`}>
                      <div className={`w-24 h-24 rounded-full mb-8 flex items-center justify-center shadow-xl ${importLog.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {importLog.success ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                      </div>
                      <h3 className={`text-3xl font-black ${importLog.success ? 'text-slate-900' : 'text-red-900'}`}>
                        {importLog.success ? 'Audit & Sync Done' : 'Audit Interrupted'}
                      </h3>
                      <p className="mt-4 font-bold text-slate-400 text-base max-w-sm leading-relaxed">
                         {importLog.success 
                            ? `Processed ${importLog.count} items. ${importLog.addedCount || 0} new parts were added to your catalog.` 
                            : importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-12 space-y-4 w-full">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                    <span className="block text-2xl font-black text-slate-900">{importLog.count}</span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 block">Items</span>
                                </div>
                                <div className="bg-teal-50 p-4 rounded-3xl border border-teal-100">
                                    <span className="block text-2xl font-black text-teal-600">{importLog.addedCount}</span>
                                    <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest mt-1 block">New SKUs</span>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
                                    <span className="block text-xl font-black text-blue-900">₹{Math.round(importLog.totalValue / 1000)}k</span>
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1 block">Net Value</span>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={shareToWhatsApp} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-5 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"><MessageCircle size={24} /> Share Audit Report</button>
                                <button onClick={() => setActiveTab('HISTORY')} className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl transition-all active:scale-95"><History size={24} /></button>
                            </div>
                        </div>
                      )}
                      <button onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); setQueuedFiles([]); }} className="mt-14 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-600 transition-colors">Process Next Bill</button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
                     <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <div className="flex items-center gap-4">
                           <div className="bg-blue-600 text-white p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-xl shadow-blue-100"><ShieldCheck size={24} /></div>
                           <div>
                              <h3 className="font-black text-slate-900 text-lg md:text-xl leading-none mb-1 md:mb-2">Extraction Review</h3>
                              <p className="text-[9px] md:text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">Dealer: {extractedMetadata.dealerName || 'Unknown'}</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-2 md:p-3 text-slate-300 hover:text-rose-500 bg-white rounded-xl md:rounded-2xl shadow-sm transition-all active:scale-90"><X size={20} /></button>
                     </div>

                     <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-start gap-3">
                        <Zap className="text-amber-600 flex-none" size={16} />
                        <p className="text-[10px] font-bold text-amber-800 leading-tight">Verify part numbers below. Pulsing tags indicate <b>New Parts</b> that will be added to your shop catalog.</p>
                     </div>

                     <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 no-scrollbar bg-slate-50/30">
                        {previewData.map((row, i) => {
                           const exists = inventory.some(item => item.partNumber.toLowerCase() === row.partNumber.toLowerCase());
                           return (
                               <div key={i} className={`bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border shadow-soft flex flex-col gap-4 animate-fade-in transition-all ${row.hasError ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                       <div className="flex-1 space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Part Number (Editable)</label>
                                          <div className="relative group/edit">
                                             <input 
                                                type="text"
                                                value={row.partNumber}
                                                onChange={e => handleEditPartNumber(i, e.target.value)}
                                                className="w-full bg-slate-50 px-4 py-3 rounded-2xl border-2 border-transparent font-black text-slate-900 text-[17px] md:text-lg leading-tight tracking-tight focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                             />
                                             {/* Replacing Edit2 with imported Edit3 */}
                                             <Edit3 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within/edit:text-blue-500" />
                                          </div>
                                       </div>
                                       <div className="pl-3 pt-5">
                                          <div className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase shadow-lg shadow-blue-100 flex items-center gap-1.5 whitespace-nowrap">
                                             <Check size={14} /> {row.quantity} Qty
                                          </div>
                                       </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                       {!exists && (
                                          <span className="flex-none bg-teal-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm animate-pulse flex items-center gap-1">
                                             <Plus size={10} strokeWidth={4} /> New Entry
                                          </span>
                                       )}
                                       <div className="text-[12px] md:text-[13px] text-slate-400 font-bold truncate flex-1">{row.name}</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 md:gap-4 pt-3 border-t border-slate-100/50">
                                    <div className="bg-slate-50/50 p-2 md:p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MRP</p>
                                        <p className="font-bold text-slate-900 text-xs md:text-sm">₹{row.mrp.toLocaleString()}</p>
                                    </div>
                                    <div className={`p-2 md:p-3 rounded-2xl border ${row.errorType === 'DISCOUNT_LOW' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">B.DC</p>
                                        <p className={`font-black text-xs md:text-sm ${row.errorType === 'DISCOUNT_LOW' ? 'text-rose-600' : 'text-slate-900'}`}>
                                          {row.discountPercent}%
                                        </p>
                                    </div>
                                    <div className="bg-blue-50/50 p-2 md:p-3 rounded-2xl border border-blue-100 text-right">
                                        <p className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Net Rate</p>
                                        <p className="font-black text-blue-700 text-xs md:text-sm">₹{row.printedUnitPrice.toLocaleString()}</p>
                                    </div>
                                </div>

                                {row.hasError && (
                                    <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg shadow-rose-200 flex gap-3 items-center animate-slide-up">
                                        <AlertTriangle className="flex-none" size={18} />
                                        <div className="text-[10px] md:text-[11px] font-black leading-tight uppercase tracking-wide">
                                          {row.errorType === 'DISCOUNT_LOW' ? (
                                              <p>Scan Alert: B.DC ({row.discountPercent}%) is below 12% standard!</p>
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

                     <div className="p-6 md:p-8 border-t border-slate-100 bg-white sticky bottom-0 z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.05)]">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 md:py-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center gap-4 active:scale-[0.98] transition-all disabled:opacity-50 text-[15px] md:text-[16px] uppercase tracking-widest">
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} Confirm & Sync Audit
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-[3rem] shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-white flex flex-col lg:flex-row items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100"><Truck size={24} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-xl tracking-tight block">Inbound Log</span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Acquisition History</span>
                      </div>
                      <div className="ml-4 flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setViewMode('STACKED')} className={`p-2 rounded-lg transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Bill Stack View"><Layers size={16} /></button>
                          <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Item List View"><List size={16} /></button>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all"><ArrowUpDown size={20} /></button>
                      <button onClick={loadHistory} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all"><Clock size={20} /></button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 no-scrollbar pb-32">
                  {loading ? <div className="flex justify-center p-20"><TharLoader /></div> : history.length === 0 ? <div className="flex flex-col items-center justify-center py-32 text-slate-300"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-soft"><History size={48} className="opacity-10" /></div><p className="font-black text-xs uppercase tracking-[0.3em]">No history found</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {viewMode === 'STACKED' ? (
                          stackedHistory.map(stack => (
                            <div 
                              key={stack.id} 
                              onClick={() => setSelectedInbound(stack)}
                              className="p-6 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-premium hover:border-blue-200 hover:shadow-xl transition-all cursor-pointer group relative animate-fade-in"
                            >
                                <div className="absolute -bottom-2 left-8 right-8 h-2 bg-blue-100 rounded-b-3xl -z-10 group-hover:-bottom-3 transition-all opacity-40"></div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><FileText size={16}/></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">INBOUND BILL</span>
                                        </div>
                                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                                            <Calendar size={12}/> {new Date(stack.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">•</span>
                                            <Clock size={12}/> {new Date(stack.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Dealer / Source</p>
                                    <div className="font-black text-lg text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                                        {stack.customerName || 'Manual Bulk Inbound'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto">
                                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                                        <Package size={14} className="text-slate-400"/>
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{stack.items.length} SKUs</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Stock Value</p>
                                        <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                            ₹{stack.totalValue.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                          ))
                        ) : (
                          sortedListHistory.map(tx => (
                            <div key={tx.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-premium animate-fade-in relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-3 h-full bg-blue-600/10 group-hover:bg-blue-600/20 transition-all"></div>
                                <div className="flex justify-between items-start mb-5">
                                    <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                                        <div className="font-black text-slate-900 text-lg leading-tight tracking-tight truncate">{tx.partNumber}</div>
                                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest"><Calendar size={12} className="text-slate-300" /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-sm">+{tx.quantity}</div>
                                </div>
                                <div className="mt-6 pt-5 border-t border-slate-50 flex justify-between items-end">
                                    <div className="flex-1 min-w-0 pr-4"><p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Source</p><p className="text-[13px] font-bold text-slate-700 truncate">{tx.customerName || 'Manual Entry'}</p></div>
                                    <div className="text-right"><p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Net Rate</p><p className="text-xl font-black text-slate-900 tracking-tighter">₹{tx.price.toLocaleString()}</p></div>
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
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in">
              <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                      <div className="flex items-center gap-5">
                          <button onClick={() => setSelectedInbound(null)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90"><ArrowLeft size={24}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2">{selectedInbound.customerName || 'Bulk Inbound'}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest">
                                  <Calendar size={14}/> {new Date(selectedInbound.createdAt).toLocaleDateString()}
                                  <span className="text-slate-200">|</span>
                                  <Clock size={14}/> {new Date(selectedInbound.createdAt).toLocaleTimeString()}
                              </div>
                          </div>
                      </div>
                      <div className="hidden md:block px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest bg-blue-50 text-blue-600">
                          INVENTORY SCAN
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                         <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm">Line Items ({selectedInbound.items.length})</h4>
                      </div>
                      <div className="space-y-3">
                          {selectedInbound.items.map((item, idx) => (
                              <div key={item.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white hover:border-blue-100 hover:shadow-md transition-all">
                                  <div className="flex items-center gap-5">
                                      <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-sm">{idx + 1}</div>
                                      <div className="min-w-0">
                                          <div className="font-black text-slate-900 text-lg leading-tight tracking-tight group-hover:text-blue-600 transition-colors">{item.partNumber}</div>
                                          <p className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mt-1">Purchase Rate: ₹{item.price.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-12 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                                      <div className="text-center md:text-right">
                                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Quantity</p>
                                          <p className="text-xl font-black text-slate-900">{item.quantity}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Subtotal</p>
                                          <p className="text-xl font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-8 md:p-10 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl"><Database size={32} /></div>
                          <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Inbound Value</p>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter">₹{selectedInbound.totalValue.toLocaleString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedInbound(null)} className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-12 py-5 rounded-[2rem] transition-all active:scale-95 uppercase text-xs tracking-widest">Close Log View</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;