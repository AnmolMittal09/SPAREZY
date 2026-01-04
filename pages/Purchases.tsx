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
        const inventoryPayload = previewData.map(item => {
            const existing = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
            return {
                partNumber: item.partNumber,
                name: item.name,
                price: item.mrp, 
                quantity: (existing?.quantity || 0) + item.quantity, 
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
    <div className="h-full flex flex-col bg-[#F1F5F9] md:bg-transparent">
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white/70 backdrop-blur-2xl p-4 border-b border-white/20 z-20 sticky top-24 shadow-soft animate-fade-in">
            <div className="flex bg-slate-100 p-1.5 rounded-3xl shadow-inner-3d">
               <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-500 ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`}>Entry</button>
               <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-500 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-3d' : 'text-slate-400'}`}>Scan</button>
               <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-500 ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`}>Log</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-12 px-1">
          <div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase">Purchase Inbound</h1>
             <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                <Database size={16} className="text-brand-500" /> Auto-sync Stock with AI verification
             </p>
          </div>
          <div className="flex bg-white p-2 rounded-4xl border border-white shadow-3d">
             <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`px-10 py-3.5 text-sm font-black rounded-3xl transition-all duration-500 flex items-center gap-3 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={20} /> Manual</button>
             <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`px-10 py-3.5 text-sm font-black rounded-3xl transition-all duration-500 flex items-center gap-3 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={20} /> AI Scan</button>
             <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`px-10 py-3.5 text-sm font-black rounded-3xl transition-all duration-500 flex items-center gap-3 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-3d' : 'text-slate-500 hover:bg-slate-50'}`}><History size={20} /> History</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 flex flex-col h-full overflow-y-auto no-scrollbar pb-48">
                {!previewData.length && !importLog && (
                  <div className="space-y-8 animate-slide-up">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-4xl p-10 flex gap-8 items-start shadow-3d">
                        <div className="p-6 bg-blue-600 text-white rounded-3xl shadow-3d transform -rotate-3 flex-none"><Calculator size={36} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="font-black text-blue-900 text-2xl uppercase tracking-tight">Audit Protocol Enabled</h3>
                            <p className="text-[16px] text-blue-700/80 mt-4 leading-relaxed font-bold">
                                Upload vendor invoices. Sparezy will audit every line for <b>12% B.DC</b> rule compliance and sync with your central inventory.
                            </p>
                        </div>
                    </div>

                    {queuedFiles.length > 0 && (
                      <div className="bg-white p-10 rounded-4xl border border-white shadow-3d">
                        <div className="flex justify-between items-center mb-10">
                           <h4 className="font-black text-slate-900 uppercase tracking-[0.3em] text-xs">Scanning Queue ({queuedFiles.length} Pages)</h4>
                           <button onClick={() => setQueuedFiles([])} className="text-rose-600 font-black text-[11px] uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-xl transition-all hover:bg-rose-100 active:scale-95">Clear All</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
                           {queuedFiles.map((q) => (
                             <div key={q.id} className="relative group aspect-[3/4] rounded-4xl overflow-hidden border-2 border-slate-100 shadow-3d bg-slate-50 card-3d">
                                {q.file.type.startsWith('image/') ? (
                                  <img src={q.preview} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                                     <FileText size={48} />
                                     <span className="text-[10px] font-black uppercase mt-4 truncate w-full">{q.file.name}</span>
                                  </div>
                                )}
                                <button 
                                  onClick={() => removeFileFromQueue(q.id)}
                                  className="absolute top-4 right-4 p-3 bg-rose-600 text-white rounded-2xl shadow-3d opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                   <p className="text-white text-[11px] font-black uppercase tracking-widest">Document {queuedFiles.indexOf(q) + 1}</p>
                                </div>
                             </div>
                           ))}
                           <label className="aspect-[3/4] rounded-4xl border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 hover:bg-slate-50 hover:text-blue-500 hover:border-blue-200 cursor-pointer transition-all active:scale-95 group">
                              <Plus size={44} className="group-hover:scale-125 transition-transform duration-500" />
                              <span className="text-[11px] font-black uppercase tracking-[0.3em] mt-4">Add Page</span>
                              <input type="file" multiple accept="application/pdf, image/*" className="hidden" onChange={handleFileSelect} />
                           </label>
                        </div>
                        
                        <div className="mt-12 border-t border-slate-50 pt-10">
                          <button 
                            onClick={startAiAudit}
                            disabled={importing}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black py-7 rounded-4xl shadow-3d flex items-center justify-center gap-5 active:scale-95 transition-all text-xl uppercase tracking-[0.2em]"
                          >
                            {importing ? <Loader2 className="animate-spin" /> : <ScanLine size={28} />}
                            {importing ? 'Extracting Data...' : 'Verify Invoice'}
                          </button>
                        </div>
                      </div>
                    )}

                    {queuedFiles.length === 0 && (
                      <div className="bg-white border-4 border-dashed border-white rounded-[4rem] p-20 text-center hover:bg-white hover:shadow-3d transition-all group shadow-inner-3d">
                        <div className="w-32 h-32 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-12 group-hover:bg-brand-500 group-hover:text-white transition-all duration-700 shadow-3d transform group-hover:rotate-12 group-hover:scale-110"><ImageIcon size={64} /></div>
                        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight uppercase">Import Document</h2>
                        <p className="text-slate-400 mb-14 max-w-xs mx-auto text-lg font-bold">Standard PDF / Camera Shots / Excel spreadsheets supported</p>
                        <label className="inline-flex items-center gap-5 bg-blue-600 hover:bg-blue-700 text-white font-black px-16 py-7 rounded-4xl cursor-pointer transition-all active:scale-95 shadow-3d uppercase text-lg tracking-[0.2em]">
                           <Upload size={32} strokeWidth={2.5} /> Select Files
                           <input type="file" multiple accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    )}
                    
                    {errorMsg && <div className="mt-14 p-8 bg-rose-50 text-rose-600 rounded-4xl border border-rose-100 text-base font-black flex items-center gap-5 justify-center animate-shake shadow-soft"><AlertCircle size={32} /> {errorMsg}</div>}
                  </div>
                )}

                {importLog && (
                  <div className={`p-16 rounded-[4rem] border-2 flex flex-col items-center text-center animate-slide-up shadow-3d bg-white ${importLog.success ? 'border-teal-100' : 'border-rose-100'}`}>
                      <div className={`w-32 h-32 rounded-full mb-12 flex items-center justify-center shadow-3d ${importLog.success ? 'bg-teal-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {importLog.success ? <CheckCircle2 size={72} /> : <AlertCircle size={72} />}
                      </div>
                      <h3 className={`text-5xl font-black uppercase tracking-tight ${importLog.success ? 'text-slate-900' : 'text-rose-900'}`}>
                        {importLog.success ? 'Audit Passed' : 'Audit Terminated'}
                      </h3>
                      <p className="mt-8 font-bold text-slate-400 text-xl max-w-sm leading-relaxed">
                         {importLog.success 
                            ? `Successfully cataloged ${importLog.count} units. ${importLog.addedCount || 0} unique SKUs newly identified.` 
                            : importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-16 space-y-8 w-full">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-slate-50 p-8 rounded-4xl border border-white shadow-inner-3d">
                                    <span className="block text-4xl font-black text-slate-900">{importLog.count}</span>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 block">Total Parts</span>
                                </div>
                                <div className="bg-teal-50 p-8 rounded-4xl border border-white shadow-inner-3d">
                                    <span className="block text-4xl font-black text-teal-600">{importLog.addedCount}</span>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 block">New SKU</span>
                                </div>
                                <div className="bg-blue-50 p-8 rounded-4xl border border-white shadow-inner-3d">
                                    <span className="block text-3xl font-black text-blue-900">₹{(importLog.totalValue / 1000).toFixed(1)}k</span>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 block">Valuation</span>
                                </div>
                            </div>
                            <div className="flex gap-6 pt-6">
                                <button onClick={shareToWhatsApp} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-black py-7 rounded-4xl shadow-3d flex items-center justify-center gap-5 transition-all active:scale-95 text-lg uppercase tracking-widest"><MessageCircle size={32} /> WhatsApp Report</button>
                                <button onClick={() => setActiveTab('HISTORY')} className="bg-slate-900 text-white p-7 rounded-4xl shadow-3d transition-all active:scale-95"><History size={32} /></button>
                            </div>
                        </div>
                      )}
                      <button onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); setQueuedFiles([]); }} className="mt-20 text-[13px] font-black text-slate-300 uppercase tracking-[0.5em] hover:text-brand-600 transition-colors">Process Next Document</button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[4rem] shadow-3d border border-white overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
                     <div className="p-10 md:p-14 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-2xl">
                        <div className="flex items-center gap-8">
                           <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-3d"><ShieldCheck size={44} /></div>
                           <div>
                              <h3 className="font-black text-slate-900 text-3xl tracking-tighter uppercase leading-none mb-3">Verification Deck</h3>
                              <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.4em]">Vendor: {extractedMetadata.dealerName || 'Manual Entry'}</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-4 text-slate-300 hover:text-rose-500 bg-white border border-slate-50 rounded-2xl shadow-soft transition-all active:scale-90"><X size={32} /></button>
                     </div>

                     <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-start gap-6">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-soft flex-none animate-pulse"><Zap size={24} /></div>
                        <p className="text-[13px] font-black text-amber-800 leading-relaxed uppercase tracking-wider py-1">Review part numbers below. Long alphanumeric codes will expand automatically. Pulsing tags highlight <b>New Parts</b>.</p>
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar bg-slate-50/40">
                        {previewData.map((row, i) => {
                           const exists = inventory.some(item => item.partNumber.toLowerCase() === row.partNumber.toLowerCase());
                           return (
                               <div key={i} className={`bg-white p-8 md:p-10 rounded-[3rem] border shadow-3d flex flex-col gap-8 animate-fade-in transition-all relative card-3d ${row.hasError ? 'border-rose-200 bg-rose-50/20' : 'border-white'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="flex flex-col gap-6">
                                    {/* Mobile Fix: Full-width Part Number on small screens */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                                       <div className="w-full flex-1 space-y-3">
                                          <div className="flex items-center justify-between">
                                              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">Part Number (Editable)</label>
                                              {!exists && (
                                                <span className="sm:hidden flex-none bg-teal-500 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase shadow-3d animate-pulse flex items-center gap-2">
                                                   <Plus size={10} strokeWidth={4} /> NEW SKU
                                                </span>
                                              )}
                                          </div>
                                          <div className="relative group/edit">
                                             <input 
                                                type="text"
                                                value={row.partNumber}
                                                onChange={e => handleEditPartNumber(i, e.target.value)}
                                                className="w-full bg-slate-50/50 px-6 py-6 pr-16 rounded-4xl border-2 border-white font-black text-slate-900 text-xl md:text-3xl leading-none tracking-tight focus:bg-white focus:border-blue-500 focus:ring-[15px] focus:ring-blue-500/5 transition-all outline-none shadow-inner-3d uppercase"
                                             />
                                             <Edit3 size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within/edit:text-blue-500 transition-colors" />
                                          </div>
                                       </div>
                                       
                                       <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-6 sm:pt-8">
                                          {!exists && (
                                            <span className="hidden sm:flex flex-none bg-teal-500 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase shadow-3d animate-pulse items-center gap-3">
                                               <Plus size={14} strokeWidth={4} /> NEW CATALOG ENTRY
                                            </span>
                                          )}
                                          <div className="bg-blue-600 text-white px-8 py-4 rounded-3xl text-lg font-black uppercase shadow-3d flex items-center gap-3 whitespace-nowrap min-w-[140px] justify-center">
                                             <Check size={24} strokeWidth={3} /> {row.quantity} QTY
                                          </div>
                                       </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-5 px-2">
                                       <div className="text-[16px] md:text-[18px] text-slate-400 font-black truncate flex-1 uppercase tracking-tight leading-relaxed">{row.name}</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 md:gap-8 pt-8 border-t border-slate-100">
                                    <div className="bg-slate-50 p-4 md:p-8 rounded-4xl border border-white shadow-inner-3d">
                                        <p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">MRP Price</p>
                                        <p className="font-black text-slate-900 text-lg md:text-3xl tracking-tighter">₹{row.mrp.toLocaleString()}</p>
                                    </div>
                                    <div className={`p-4 md:p-8 rounded-4xl border shadow-inner-3d ${row.errorType === 'DISCOUNT_LOW' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-white'}`}>
                                        <p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Net Disc %</p>
                                        <p className={`font-black text-lg md:text-3xl tracking-tighter ${row.errorType === 'DISCOUNT_LOW' ? 'text-rose-600' : 'text-slate-900'}`}>
                                          {row.discountPercent}%
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-4 md:p-8 rounded-4xl border border-white text-right shadow-inner-3d">
                                        <p className="text-[10px] md:text-[12px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3">Audit Rate</p>
                                        <p className="font-black text-blue-700 text-lg md:text-3xl tracking-tighter">₹{row.printedUnitPrice.toLocaleString()}</p>
                                    </div>
                                </div>

                                {row.hasError && (
                                    <div className="bg-rose-600 text-white p-6 md:p-8 rounded-[2.5rem] shadow-3d flex gap-6 items-center animate-slide-up">
                                        <div className="w-14 h-14 bg-white/20 rounded-3xl flex items-center justify-center flex-none"><AlertTriangle size={32} /></div>
                                        <div className="text-[13px] md:text-[16px] font-black leading-tight uppercase tracking-[0.15em]">
                                          {row.errorType === 'DISCOUNT_LOW' ? (
                                              <p>B.DC DISCREPANCY: Vendor discount ({row.discountPercent}%) is below 12% shop standard.</p>
                                          ) : (
                                              <p>MATH ANOMALY: Expected billing rate was ₹{row.calculatedPrice.toLocaleString()} at 12% B.DC.</p>
                                          )}
                                        </div>
                                    </div>
                                )}
                            </div>
                           );
                        })}
                     </div>

                     <div className="p-10 md:p-16 border-t border-slate-100 bg-white sticky bottom-0 z-10 shadow-[0_-40px_80px_rgba(0,0,0,0.1)]">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-8 md:py-10 rounded-[3rem] shadow-3d flex items-center justify-center gap-8 active:scale-[0.98] transition-all disabled:opacity-50 text-[20px] md:text-[26px] uppercase tracking-[0.3em]">
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={40} strokeWidth={2.5} />} Finalize & Sync Inbound
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white md:rounded-[4rem] shadow-3d border border-white flex flex-col h-full overflow-hidden">
                <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
                   <div className="flex items-center gap-8">
                      <div className="p-6 bg-slate-900 text-white rounded-4xl shadow-3d transform -rotate-3"><Truck size={40} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-3xl tracking-tighter block uppercase">Inbound Journal</span>
                         <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] mt-2 block">Warehouse Acquisition Audit</span>
                      </div>
                      <div className="ml-10 hidden sm:flex bg-slate-100 p-2 rounded-3xl shadow-inner-3d">
                          <button onClick={() => setViewMode('STACKED')} className={`p-3 rounded-2xl transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`} title="Stack View"><Layers size={24} /></button>
                          <button onClick={() => setViewMode('LIST')} className={`p-3 rounded-2xl transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-3d' : 'text-slate-400'}`} title="Registry View"><List size={24} /></button>
                      </div>
                   </div>
                   <div className="flex items-center gap-5">
                      <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')} className="p-5 bg-slate-50 text-slate-500 rounded-3xl hover:bg-white hover:shadow-premium active:scale-95 transition-all border border-white shadow-3d"><ArrowUpDown size={28} /></button>
                      <button onClick={loadHistory} className="p-5 bg-slate-50 text-slate-500 rounded-3xl hover:bg-white hover:shadow-premium active:scale-95 transition-all border border-white shadow-3d"><Clock size={28} /></button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 md:p-14 space-y-10 no-scrollbar pb-60 bg-slate-50/30">
                  {loading ? <div className="flex justify-center p-40"><TharLoader /></div> : history.length === 0 ? <div className="flex flex-col items-center justify-center py-52 text-slate-200"><div className="w-40 h-40 bg-white rounded-[4rem] flex items-center justify-center mb-12 shadow-3d"><History size={80} className="opacity-10" /></div><p className="font-black text-[16px] uppercase tracking-[0.6em]">No Audit Records</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {viewMode === 'STACKED' ? (
                          stackedHistory.map(stack => (
                            <div 
                              key={stack.id} 
                              onClick={() => setSelectedInbound(stack)}
                              className="p-10 bg-white rounded-[3.5rem] border-2 border-white shadow-3d hover:border-brand-300 hover:shadow-3d-hover transition-all cursor-pointer group relative animate-fade-in card-3d"
                            >
                                <div className="absolute -bottom-4 left-12 right-12 h-4 bg-slate-200/50 rounded-b-[3.5rem] -z-10 group-hover:-bottom-5 transition-all"></div>
                                <div className="flex justify-between items-start mb-10">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-2xl bg-brand-50 text-brand-600"><FileText size={24}/></div>
                                            <span className="text-[12px] font-black uppercase tracking-[0.4em] text-brand-600">CERTIFIED BILL</span>
                                        </div>
                                        <div className="text-[13px] font-bold text-slate-400 flex items-center gap-4">
                                            <Calendar size={16}/> {new Date(stack.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">|</span>
                                            <Clock size={16}/> {new Date(stack.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="bg-brand-600 text-white w-14 h-14 rounded-3xl flex items-center justify-center shadow-3d active:scale-90 transition-all group-hover:rotate-6">
                                        <ChevronRight size={32} />
                                    </div>
                                </div>
                                <div className="mb-10">
                                    <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] mb-3">Origin Vendor</p>
                                    <div className="font-black text-2xl text-slate-900 leading-tight truncate group-hover:text-brand-600 transition-colors uppercase">
                                        {stack.customerName || 'Bulk Manual System'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-50 pt-8 mt-auto">
                                    <div className="bg-slate-50 px-5 py-2.5 rounded-2xl border border-white flex items-center gap-4 shadow-inner-3d">
                                        <Package size={22} className="text-slate-400"/>
                                        <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">{stack.items.length} SKUs</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-2">Total Value</p>
                                        <p className="text-4xl font-black text-slate-900 tracking-tighter">
                                            ₹{stack.totalValue.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                          ))
                        ) : (
                          sortedListHistory.map(tx => (
                            <div key={tx.id} className="p-10 bg-white rounded-[3rem] border border-white shadow-3d animate-fade-in relative group overflow-hidden card-3d">
                                <div className="absolute top-0 right-0 w-5 h-full bg-brand-600/5 group-hover:bg-brand-600/10 transition-all"></div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="space-y-3 flex-1 min-w-0 pr-8">
                                        <div className="font-black text-slate-900 text-2xl md:text-3xl leading-none tracking-tighter truncate uppercase">{tx.partNumber}</div>
                                        <div className="flex items-center gap-4 text-slate-400 text-[12px] font-black uppercase tracking-[0.3em]"><Calendar size={16} className="text-slate-200" /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="bg-brand-50 text-brand-600 px-5 py-2.5 rounded-2xl text-[14px] font-black uppercase tracking-[0.1em] shadow-inner-3d">+{tx.quantity}</div>
                                </div>
                                <div className="mt-10 pt-8 border-t border-slate-50 flex justify-between items-end">
                                    <div className="flex-1 min-w-0 pr-8"><p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-3 uppercase">Dealer</p><p className="text-[17px] font-black text-slate-700 truncate uppercase">{tx.customerName || 'Audit Entry'}</p></div>
                                    <div className="text-right"><p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-3 uppercase">Net Rate</p><p className="text-3xl font-black text-slate-900 tracking-tighter">₹{tx.price.toLocaleString()}</p></div>
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
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-3xl flex items-center justify-center p-4 lg:p-16 animate-fade-in">
              <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-[0_60px_120px_rgba(0,0,0,0.4)] flex flex-col max-h-[94vh] overflow-hidden animate-slide-up border border-white/20">
                  <div className="p-10 md:p-16 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-2xl">
                      <div className="flex items-center gap-10">
                          <button onClick={() => setSelectedInbound(null)} className="p-6 bg-white text-slate-400 hover:text-slate-900 rounded-3xl shadow-3d border border-slate-50 transition-all active:scale-90 transform hover:-translate-x-2"><ArrowLeft size={36}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-4xl md:text-5xl tracking-tighter leading-none mb-4 uppercase">{selectedInbound.customerName || 'Inbound Batch'}</h3>
                              <div className="flex items-center gap-6 text-slate-400 text-[16px] font-black uppercase tracking-[0.3em]">
                                  <Calendar size={22} strokeWidth={3}/> {new Date(selectedInbound.createdAt).toLocaleDateString()}
                                  <span className="text-slate-200">|</span>
                                  <Clock size={22} strokeWidth={3}/> {new Date(selectedInbound.createdAt).toLocaleTimeString()}
                              </div>
                          </div>
                      </div>
                      <div className="hidden md:block px-10 py-4 rounded-3xl text-[16px] font-black uppercase tracking-[0.4em] bg-brand-50 text-brand-600 shadow-inner-3d">
                          CERTIFIED AUDIT
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 md:p-16 no-scrollbar space-y-8 bg-slate-50/40">
                      <div className="flex items-center gap-6 mb-10">
                         <div className="w-3 h-12 bg-brand-600 rounded-full shadow-3d"></div>
                         <h4 className="font-black text-slate-900 uppercase tracking-[0.4em] text-lg">Inbound Line Audit ({selectedInbound.items.length})</h4>
                      </div>
                      <div className="space-y-6">
                          {selectedInbound.items.map((item, idx) => (
                              <div key={item.id} className="p-10 bg-white rounded-[3rem] border border-white flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-brand-200 hover:shadow-3d transition-all card-3d">
                                  <div className="flex items-center gap-10">
                                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center font-black text-slate-300 text-2xl shadow-inner-3d">{idx + 1}</div>
                                      <div className="min-w-0">
                                          <div className="font-black text-slate-900 text-3xl md:text-4xl leading-none tracking-tighter group-hover:text-brand-600 transition-colors uppercase">{item.partNumber}</div>
                                          <p className="text-[16px] text-slate-400 font-black uppercase tracking-[0.3em] mt-4">Certified Inbound Rate: ₹{item.price.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-20 border-t md:border-t-0 border-slate-100 pt-8 md:pt-0">
                                      <div className="text-center md:text-right">
                                          <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] mb-3">Quantity</p>
                                          <p className="text-3xl font-black text-slate-900">{item.quantity}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] mb-3">Line Valuation</p>
                                          <p className="text-4xl font-black text-slate-900 tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-12 md:p-16 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-10 shadow-[0_-40px_100px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-10">
                          <div className="p-8 bg-blue-600 text-white rounded-4xl shadow-3d transform -rotate-3 scale-110"><Database size={48} strokeWidth={2.5} /></div>
                          <div>
                              <p className="text-[14px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4">Final Stock Valuation</p>
                              <p className="text-6xl font-black text-slate-900 tracking-tighter">₹{selectedInbound.totalValue.toLocaleString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedInbound(null)} className="w-full md:w-auto bg-slate-900 hover:bg-black text-white font-black px-20 py-8 rounded-[2.5rem] transition-all active:scale-95 uppercase text-[18px] tracking-[0.4em] shadow-3d transform hover:-translate-y-2">Close Inbound Log</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default Purchases;