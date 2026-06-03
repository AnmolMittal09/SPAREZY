
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Percent,
  Edit2
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions, deleteGroupedTransactions, updateGroupedInvoiceDetails } from '../services/transactionService';
import { fetchInventory, updateOrAddItems } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import TharLoader from '../components/TharLoader';
import ConfirmModal from '../components/ConfirmModal';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabRaw = searchParams.get('tab') || 'manual';
  const activeTab = useMemo(() => {
    const raw = activeTabRaw.toLowerCase();
    if (raw === 'import' || raw === 'ai' || raw === 'aiscan') return 'IMPORT';
    if (raw === 'history') return 'HISTORY';
    return 'NEW';
  }, [activeTabRaw]);

  const setActiveTab = useCallback((tab: 'NEW' | 'IMPORT' | 'HISTORY') => {
    const mapping = {
      NEW: 'manual',
      IMPORT: 'aiscan',
      HISTORY: 'history'
    };
    setSearchParams({ tab: mapping[tab] });
  }, [setSearchParams]);

  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInbound, setSelectedInbound] = useState<GroupedInbound | null>(null);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ 
    success: boolean; 
    message: string; 
    count: number; 
    totalValue: number; 
    errorCount: number; 
    addedCount?: number; 
    updatedCount?: number; 
    dealer?: string;
    excludedCount?: number;
    excludedList?: { partNumber: string; reason: string; quantity: number }[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [removedItems, setRemovedItems] = useState<{ partNumber: string; name: string; quantity: number; reason: string; mrp: number; printedUnitPrice: number; discountPercent: number; diff: number }[]>([]);
  const [itemToRemove, setItemToRemove] = useState<ExtractedItem | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [customReasonOpen, setCustomReasonOpen] = useState(false);
  const [extractedMetadata, setExtractedMetadata] = useState<{ dealerName?: string; invoiceDate?: string; invoiceNumber?: string }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand>(Brand.HYUNDAI);
  const [billToDelete, setBillToDelete] = useState<GroupedInbound | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBill, setDeletingBill] = useState(false);

  const [isEditingInboundInfo, setIsEditingInboundInfo] = useState(false);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');

  useEffect(() => {
    if (selectedInbound) {
      const { supplier, invNo, invDate } = parseSupplier(selectedInbound.customerName);
      setEditSupplierName(supplier || '');
      setEditInvoiceNo(invNo || '');
      setEditInvoiceDate(invDate || '');
      setIsEditingInboundInfo(false);
    }
  }, [selectedInbound]);

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
    if (!name) return { supplier: 'Main Provider', invNo: null, invDate: null };
    // Try structured format first: "NAME (INV: NO, DATE: DATE)" or "NAME (INV: NO, DATE: DATE)"
    const structuredMatch = name.match(/^(.+?)\s*\(INV:\s*(.*?),\s*DATE:\s*(.*?)\)$/i);
    if (structuredMatch) {
      return {
        supplier: structuredMatch[1].trim(),
        invNo: structuredMatch[2].trim() === 'N/A' || !structuredMatch[2].trim() ? null : structuredMatch[2].trim(),
        invDate: structuredMatch[3].trim() === 'N/A' || !structuredMatch[3].trim() ? null : structuredMatch[3].trim()
      };
    }
    // Alternatively, if it has just "INV: NO"
    const onlyInvMatch = name.match(/^(.+?)\s*\(INV:\s*(.*?)\)$/i);
    if (onlyInvMatch) {
      return {
        supplier: onlyInvMatch[1].trim(),
        invNo: onlyInvMatch[2].trim() === 'N/A' || !onlyInvMatch[2].trim() ? null : onlyInvMatch[2].trim(),
        invDate: null
      };
    }
    // Fallback for previous style: "NAME (INV: DATE)"
    const parts = name.split(' (INV: ');
    if (parts.length > 1) {
      return { 
        supplier: parts[0].trim(), 
        invNo: null,
        invDate: parts[1].replace(')', '').trim() 
      };
    }
    return { supplier: name, invNo: null, invDate: null };
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
    setRemovedItems([]);
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
          setExtractedMetadata({ 
            dealerName: result.dealerName, 
            invoiceDate: result.invoiceDate, 
            invoiceNumber: result.invoiceNumber 
          });
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
    
    let metadataParts = [];
    metadataParts.push(`INV: ${extractedMetadata.invoiceNumber || 'N/A'}`);
    metadataParts.push(`DATE: ${extractedMetadata.invoiceDate || 'N/A'}`);
    const metadataStr = metadataParts.join(', ');
    
    const sourceName = (extractedMetadata.dealerName 
      ? `${extractedMetadata.dealerName} (${metadataStr})` 
      : `AI Audit (${new Date().toLocaleDateString()})`).toUpperCase().trim();
    
    try {
        // FIX: We do NOT calculate the new quantity manually here. 
        // updateOrAddItems is used to upsert master data (Name, Brand, Price).
        // createBulkTransactions then handles the actual stock increment logic based on Purchase type.
        const inventoryPayload = previewData.map(item => ({
            partNumber: item.partNumber, 
            name: item.name, 
            price: item.mrp,
            brand: selectedBrand
            // quantity is omitted so updateOrAddItems preserves existing or defaults to 0 for new parts
        }));
        
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
        
        const excludedListCopy = removedItems.map(item => ({
            partNumber: item.partNumber,
            reason: item.reason,
            quantity: item.quantity
        }));
        
        setImportLog({ 
            success: true, message: "Ledger Synchronized.", count: previewData.length,
            totalValue: txPayload.reduce((s, i) => s + (i.price * i.quantity), 0),
            errorCount: previewData.filter(i => i.hasError).length,
            addedCount: syncRes.added, updatedCount: syncRes.updated, dealer: extractedMetadata.dealerName,
            excludedCount: excludedListCopy.length,
            excludedList: excludedListCopy
        });
        setPreviewData([]); setQueuedFiles([]); setRemovedItems([]);
    } catch (err: any) { setImportLog({ success: false, message: err.message, count: 0, totalValue: 0, errorCount: 0 }); }
    finally { setImporting(false); loadHistory(); }
  };

  const triggerDeleteBill = (stack: GroupedInbound) => {
    setBillToDelete(stack);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteBill = async () => {
    if (!billToDelete) return;
    setDeletingBill(true);
    try {
      const txIds = billToDelete.items.map(i => i.id);
      const res = await deleteGroupedTransactions(txIds, billToDelete.items);
      if (res.success) {
        setShowDeleteConfirm(false);
        setBillToDelete(null);
        setSelectedInbound(null);
        await loadHistory();
        await fetchInventory().then(setInventory);
      } else {
        alert("Error deleting bill: " + (res.message || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeletingBill(false);
    }
  };

   return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck size={24} /></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Purchase Inbound</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acquisition Journal</p>
             </div>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'IMPORT' && (
             <div className="flex-1 md:overflow-y-auto p-4 md:p-10 space-y-8 no-scrollbar bg-white md:rounded-[2.5rem] shadow-soft border border-slate-100">
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

                     {errorMsg && (
                        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-6 flex items-start gap-4 text-rose-900 shadow-soft animate-fade-in relative z-10 mb-6">
                           <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                              <AlertCircle size={20} className="stroke-[2.5]" strokeWidth={2.5} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 mb-1 animate-pulse">Scanning Issue Detected</h4>
                              <p className="text-xs text-rose-700/95 leading-relaxed font-semibold">
                                 {errorMsg}
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                 <button 
                                   onClick={() => setErrorMsg(null)}
                                   className="text-[9px] font-black uppercase tracking-wider bg-rose-100 hover:bg-rose-200 text-rose-800 px-3 py-2 rounded-lg transition-all"
                                 >
                                    Dismiss Error
                                 </button>
                                 <button 
                                   onClick={startAiAudit}
                                   disabled={importing}
                                   className="text-[9px] font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
                                 >
                                    Force Retry
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}

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
                      <div className="flex flex-col gap-5 sm:gap-6 bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                               <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shrink-0 shadow-xl shadow-blue-500/20">
                                  <Sparkles size={24} className="sm:size-[28px]" strokeWidth={2.5} />
                               </div>
                               <div className="min-w-0">
                                  <h3 className="text-lg sm:text-2xl font-black tracking-tight uppercase leading-snug sm:leading-none mb-1.5 sm:mb-2 break-words">{extractedMetadata.dealerName || 'Extracted Dealer'}</h3>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-blue-400">
                                     <span className="bg-white/10 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg ring-1 ring-white/20">{selectedBrand}</span>
                                     {extractedMetadata.invoiceNumber && (
                                        <div className="flex items-center gap-1.5 bg-white/10 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg ring-1 ring-white/10">
                                           <FileText size={10} className="sm:size-[12px]" strokeWidth={2.5} />
                                           <span>Inv No: {extractedMetadata.invoiceNumber}</span>
                                        </div>
                                     )}
                                     <div className="flex items-center gap-1.5 bg-white/5 sm:bg-transparent px-2 py-0.5 sm:px-0 sm:py-0 rounded-lg"><Calendar size={12} className="sm:size-[14px]" /> {extractedMetadata.invoiceDate || 'No Date'}</div>
                                     <div className="flex items-center gap-1.5 bg-white/5 sm:bg-transparent px-2 py-0.5 sm:px-0 sm:py-0 rounded-lg"><Layers size={12} className="sm:size-[14px]" /> {fd(previewData.length)} Assets Logged</div>
                                     <div className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg ring-1 ring-blue-500/35 font-black text-[9px] uppercase tracking-widest leading-none shrink-0">
                                        <Calculator size={11} />
                                        <span>Total: ₹{previewData.reduce((s, i) => s + (i.printedUnitPrice * i.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                     </div>
                                  </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                               <button onClick={() => { setPreviewData([]); setQueuedFiles([]); }} className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Cancel</button>
                               <button onClick={confirmBulkImport} disabled={importing} className="w-full sm:w-auto px-6 sm:px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 min-w-[140px]">
                                  {importing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                  <span>{importing ? 'Syncing...' : 'Sync to Ledger'}</span>
                               </button>
                            </div>
                         </div>

                         {/* EDITABLE BILL METADATA OVERRIDES */}
                         <div className="bg-white/5 p-4 sm:p-6 rounded-2xl border border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                            <div>
                               <label className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-300 block mb-1.5">Verify Dealer / Vendor Name</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white uppercase outline-none focus:border-blue-400 focus:bg-white/20 transition-all placeholder-white/30"
                                 placeholder="Dealer Name"
                                 value={extractedMetadata.dealerName || ''}
                                 onChange={e => setExtractedMetadata(prev => ({ ...prev, dealerName: e.target.value }))}
                               />
                            </div>
                            <div>
                               <label className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-300 block mb-1.5">Invoice/Bill No. (Type Manually if Wrong)</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white uppercase outline-none focus:border-blue-400 focus:bg-white/20 transition-all placeholder-white/30 text-yellow-300"
                                 placeholder="Type Invoice Number (e.g. GST-1293)"
                                 value={extractedMetadata.invoiceNumber || ''}
                                 onChange={e => setExtractedMetadata(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                               />
                               <span className="text-[8px] font-black text-slate-400 mt-1 block uppercase tracking-wider">AI may misdetect — review and correct here.</span>
                            </div>
                            <div>
                               <label className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-300 block mb-1.5">Verify Invoice Date</label>
                               <input 
                                 type="text" 
                                 className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white uppercase outline-none focus:border-blue-400 focus:bg-white/20 transition-all placeholder-white/30"
                                 placeholder="Invoice Date"
                                 value={extractedMetadata.invoiceDate || ''}
                                 onChange={e => setExtractedMetadata(prev => ({ ...prev, invoiceDate: e.target.value }))}
                               />
                            </div>
                            <div className="bg-white/10 border border-white/15 p-4 rounded-xl flex flex-col justify-center min-w-0">
                               <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-300 mb-1.5">TOTAL AUDITED AMOUNT</span>
                               <span className="text-xl sm:text-2xl font-black text-white tracking-tighter tabular-nums truncate">
                                  ₹{previewData.reduce((s, i) => s + (i.printedUnitPrice * i.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                               </span>
                               <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wide mt-1">
                                  {fd(previewData.reduce((s, i) => s + i.quantity, 0))} Total spare pieces
                               </span>
                            </div>
                         </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl sm:rounded-[2.5rem] overflow-x-auto no-scrollbar shadow-soft">
                        <table className="w-full text-left text-sm border-collapse min-w-[700px] md:min-w-0">
                           <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100">
                              <tr>
                                 <th className="px-8 py-6">Identity / Part</th>
                                 <th className="px-8 py-6 text-center">Batch Qty</th>
                                 <th className="px-8 py-6 text-right">Extracted B.DC</th>
                                 <th className="px-8 py-6 text-right">Printed Net</th>
                                 <th className="px-8 py-6 text-right">Protocol Audit ({currentDiscountRate}%)</th>
                                 <th className="px-8 py-6 text-center">Action</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {previewData.map((item, idx) => (
                                 <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${item.hasError ? 'bg-rose-50/20' : ''}`}>
                                    <td className="px-8 py-6">
                                       <div className="flex flex-col gap-2 max-w-[280px]">
                                          <div className="flex items-center gap-2">
                                             <input
                                                type="text"
                                                className="font-black text-slate-900 text-sm uppercase tracking-tight bg-slate-100/80 hover:bg-slate-200/50 focus:bg-white border-2 border-slate-200/60 focus:border-blue-600 rounded-xl px-3 py-1.5 w-full outline-none transition-all uppercase"
                                                value={item.partNumber}
                                                title="Edit Part Number"
                                                placeholder="PART NUMBER"
                                                onChange={(e) => {
                                                   const val = e.target.value.toUpperCase();
                                                   setPreviewData(prev => prev.map((p, pIdx) => {
                                                      if (pIdx === idx) {
                                                         const matchedStock = inventory.find(stock => stock.partNumber.toUpperCase().trim() === val.trim());
                                                         return {
                                                            ...p,
                                                            partNumber: val,
                                                            name: matchedStock ? matchedStock.name : p.name
                                                         };
                                                      }
                                                      return p;
                                                   }));
                                                }}
                                             />
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                             <div className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-[180px]" title={item.name}>
                                                {item.name}
                                             </div>
                                             {(() => {
                                                const exists = inventory.some(stock => stock.partNumber.toUpperCase().trim() === item.partNumber.toUpperCase().trim());
                                                return exists ? (
                                                   <span className="text-[8px] font-black text-blue-600 bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md uppercase tracking-widest leading-none shrink-0">
                                                      Catalogued
                                                   </span>
                                                ) : (
                                                   <span className="text-[8px] font-black text-amber-600 bg-amber-50/80 border border-amber-100/50 px-2 py-0.5 rounded-md uppercase tracking-widest leading-none shrink-0">
                                                      New Part
                                                   </span>
                                                );
                                             })()}
                                          </div>
                                       </div>
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
                                    <td className="px-8 py-6 text-center">
                                       <button 
                                          onClick={() => {
                                             setItemToRemove(item);
                                             setRemovalReason('');
                                             setCustomReasonOpen(false);
                                          }}
                                          className="p-2.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100 active:scale-95 shadow-soft hover:shadow-md"
                                          title="Remove from Scan Ingest"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                           <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-800 uppercase text-xs">
                              <tr>
                                 <td className="px-8 py-6 text-[10px] text-slate-500 tracking-wider">
                                    Total Bill Ingest Summary
                                 </td>
                                 <td className="px-8 py-6 text-center text-slate-900 text-[17px] tabular-nums">
                                    #{fd(previewData.reduce((s, i) => s + i.quantity, 0))} Pcs
                                 </td>
                                 <td className="px-8 py-6"></td>
                                 <td className="px-8 py-6 text-right text-blue-600 text-[20px] tabular-nums">
                                    ₹{previewData.reduce((s, i) => s + (i.printedUnitPrice * i.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </td>
                                 <td className="px-8 py-6 pr-12 text-right text-[10px] text-slate-400 tracking-widest" colSpan={2}>
                                    Net Verified Bill Total
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>

                     {/* DISPLAY EXCLUDED SKU'S IF ANY */}
                     {removedItems.length > 0 && (
                        <div className="bg-rose-50/20 border border-rose-100 p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] space-y-4 shadow-soft animate-fade-in">
                           <div className="flex items-center justify-between border-b border-rose-100/50 pb-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm">
                                    <Trash2 size={18} strokeWidth={2.5} />
                                 </div>
                                 <div>
                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">Omitted Parts ({removedItems.length})</h4>
                                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-[0.1em] font-bold">Flagged / Damaged / Missing items excluded from ingest ledger</p>
                                 </div>
                              </div>
                           </div>
                           <div className="divide-y divide-rose-150">
                              {removedItems.map((removed, rIdx) => (
                                 <div key={rIdx} className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1 space-y-1">
                                       <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-black text-slate-800 text-sm sm:text-base uppercase tracking-tight line-through opacity-60">{removed.partNumber}</span>
                                          <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                             Reason: {removed.reason}
                                          </span>
                                       </div>
                                       <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-xs">{removed.name}</p>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-0 pt-3 sm:pt-0 border-rose-105">
                                       <div className="text-right">
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block">Excl. Qty</span>
                                          <p className="font-black text-slate-700 text-sm sm:text-base tabular-nums">#{fd(removed.quantity)} Pcs</p>
                                       </div>
                                       <button
                                          onClick={() => {
                                             // Restore item back to previewData
                                             setPreviewData(prev => [...prev, {
                                                ...removed,
                                                calculatedPrice: parseFloat((removed.mrp * (1 - currentDiscountRate / 100)).toFixed(2)),
                                                hasError: removed.discountPercent < currentDiscountRate || Math.abs(removed.printedUnitPrice - (removed.mrp * (1 - currentDiscountRate / 100))) > 0.5,
                                                errorType: removed.discountPercent < currentDiscountRate ? 'DISCOUNT_LOW' : (Math.abs(removed.printedUnitPrice - (removed.mrp * (1 - currentDiscountRate / 100))) > 0.5 ? 'CALC_MISMATCH' : 'NONE'),
                                                diff: parseFloat((removed.printedUnitPrice - (removed.mrp * (1 - currentDiscountRate / 100))).toFixed(2))
                                             }]);
                                             // Remove from removedItems
                                             setRemovedItems(prev => prev.filter((_, idx) => idx !== rIdx));
                                          }}
                                          className="px-4 py-2 bg-white text-slate-600 hover:text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all border border-slate-205 shadow-soft select-none active:scale-95 flex items-center gap-1.5"
                                       >
                                          <RotateCcw size={12} strokeWidth={2.5} />
                                          Restore
                                       </button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}

                     {/* REASON SPECIFICATION MODAL */}
                     {itemToRemove && (
                        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                           <div className="bg-white w-full max-w-md rounded-[2.5rem] border border-slate-100 shadow-premium p-8 animate-scale-up space-y-6">
                              <div className="flex items-center justify-between">
                                 <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl border border-rose-100 shadow-sm">
                                    <Trash2 size={24} />
                                 </div>
                                 <button onClick={() => { setItemToRemove(null); setRemovalReason(''); setCustomReasonOpen(false); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                                    <X size={20} />
                                 </button>
                              </div>
                              <div>
                                 <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-snug">Exclude SKU from Journal</h4>
                                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Specify removal reason for audit compliance</p>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1 shadow-inner-soft">
                                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Target SKU Reference</span>
                                 <div className="font-black text-slate-900 text-sm uppercase">{itemToRemove.partNumber}</div>
                                 <div className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-xs">{itemToRemove.name}</div>
                              </div>

                              <div className="space-y-3">
                                 <label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 block mb-1">Select Removal Protocol</label>
                                 <div className="grid grid-cols-2 gap-2">
                                    {[
                                       'Damaged or Broken',
                                       'Shortage In Shipment',
                                       'Incorrect Item Sent',
                                       'Billing Rate Incorrect',
                                       'Omitted from Order'
                                    ].map(preset => (
                                       <button
                                          key={preset}
                                          onClick={() => {
                                             setRemovalReason(preset);
                                          }}
                                          className={`py-3 px-2 text-[9px] font-black uppercase tracking-wider rounded-xl border text-center transition-all active:scale-95 ${
                                             removalReason === preset
                                                ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-soft'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                                          }`}
                                       >
                                          {preset}
                                       </button>
                                    ))}
                                    <button
                                       onClick={() => {
                                          setRemovalReason('');
                                          setCustomReasonOpen(true);
                                       }}
                                       className={`py-3 px-2 text-[9px] font-black uppercase tracking-wider rounded-xl border text-center transition-all active:scale-95 ${
                                          customReasonOpen
                                             ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-soft'
                                             : 'bg-white hover:bg-slate-50 border-slate-205 text-slate-500 hover:text-slate-700'
                                       }`}
                                    >
                                       Custom Reason...
                                    </button>
                                 </div>

                                 {(customReasonOpen || !['Damaged or Broken', 'Shortage In Shipment', 'Incorrect Item Sent', 'Billing Rate Incorrect', 'Omitted from Order', ''].includes(removalReason)) && (
                                    <div className="mt-4 animate-fade-in">
                                       <input
                                          type="text"
                                          placeholder="Type detailed custom reason..."
                                          className="w-full bg-slate-50 border border-slate-250 rounded-xl px-4 py-3.5 text-xs font-black uppercase outline-none focus:border-rose-500 focus:bg-white transition-all placeholder-slate-400 text-slate-800 shadow-inner-soft focus:shadow-md"
                                          value={removalReason}
                                          onChange={e => {
                                             setRemovalReason(e.target.value);
                                          }}
                                       />
                                    </div>
                                 )}
                              </div>

                              <button
                                 disabled={!removalReason.trim()}
                                 onClick={() => {
                                    if (!itemToRemove) return;
                                    setRemovedItems(prev => [...prev, { ...itemToRemove, reason: removalReason.trim().toUpperCase() }]);
                                    setPreviewData(prev => prev.filter(p => p.partNumber !== itemToRemove.partNumber));
                                    setItemToRemove(null);
                                    setRemovalReason('');
                                    setCustomReasonOpen(false);
                                 }}
                                 className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-40 shadow-xl shadow-rose-100"
                              >
                                 <Trash2 size={16} />
                                 <span>Exclude SKU Reference</span>
                              </button>
                           </div>
                        </div>
                     )}
                  </div>
               )}

               {importLog && (
                  <div className="max-w-xl mx-auto bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium text-center animate-slide-up">
                     <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl ${importLog.success ? 'bg-teal-50 text-teal-600 shadow-teal-100' : 'bg-rose-50 text-rose-600 shadow-rose-100'}`}>
                        {importLog.success ? <Check size={40} strokeWidth={4} /> : <AlertCircle size={40} strokeWidth={4} />}
                     </div>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-4">{importLog.message}</h3>
                     
                     {importLog.success && importLog.addedCount !== undefined && importLog.addedCount > 0 && (
                        <div className="mb-6 p-5 bg-emerald-50 border border-emerald-100 rounded-[2rem] text-left animate-fade-in shadow-inner-soft">
                           <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                              <Sparkles size={14} className="text-emerald-500 animate-pulse" strokeWidth={2.5} /> New Part(s) Added Successfully
                           </h4>
                           <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
                              {importLog.addedCount} new spare part(s) were auto-detected and **created directly in your inventory** as catalogued listings!
                           </p>
                        </div>
                     )}

                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Asset Volume</p>
                           <p className="text-2xl font-black text-slate-900">{fd(importLog.count)} SKUs</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grand Value</p>
                           <p className="text-2xl font-black text-slate-900">₹{importLog.totalValue.toLocaleString()}</p>
                        </div>
                     </div>

                     {importLog.excludedList && importLog.excludedList.length > 0 && (
                        <div className="mt-2 mb-8 p-6 bg-rose-50/20 border border-rose-100 rounded-[2rem] text-left">
                           <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <Trash2 size={12} strokeWidth={2.5} /> Excluded Items Omitted from Stock
                           </h4>
                           <div className="divide-y divide-rose-100/50 max-h-40 overflow-y-auto no-scrollbar">
                              {importLog.excludedList.map((item, idex) => (
                                 <div key={idex} className="py-2.5 flex items-center justify-between text-xs gap-4">
                                    <span className="font-black text-slate-800 uppercase tracking-tight truncate flex-1">{item.partNumber} <span className="text-slate-400">({fd(item.quantity)} Pcs)</span></span>
                                    <span className="bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase whitespace-nowrap">
                                       {item.reason}
                                    </span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}

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
                                const { supplier, invNo, invDate } = parseSupplier(stack.customerName);
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
                                               <span>Date: {invDate || new Date(stack.createdAt).toLocaleDateString()}</span>
                                                {invNo && (
                                                   <span className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-indigo-600 text-[9px] font-black tracking-widest shadow-soft ml-2">
                                                      <FileText size={10} strokeWidth={2.5} />
                                                      No: {invNo}
                                                   </span>
                                                )}
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
                                      <div className="flex items-center gap-3">
                                         <button 
                                            onClick={(e) => {
                                               e.stopPropagation();
                                               triggerDeleteBill(stack);
                                            }}
                                            className="p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all border border-rose-100 flex items-center justify-center shadow-soft"
                                            title="Delete Bill"
                                         >
                                            <Trash2 size={16} />
                                         </button>
                                         <div className="hidden md:block">
                                            <ChevronRight size={20} className="text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                         </div>
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
                      <div className="flex items-center gap-4 w-full">
                          <button onClick={() => setSelectedInbound(null)} className="p-3 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={22} strokeWidth={3}/></button>
                          <div className="min-w-0 flex-1">
                              {isEditingInboundInfo ? (
                                  <div className="flex flex-col gap-3 p-4 bg-slate-100/80 border border-slate-200 rounded-2xl w-full max-w-xl shadow-inner-soft mt-1">
                                      <span className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.15em] mb-1">Correct Invoice/Supplier Metadata</span>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <div>
                                              <label className="text-[8px] font-black uppercase text-slate-500 block mb-1">Supplier Name</label>
                                              <input
                                                  type="text"
                                                  className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-205 rounded-xl outline-none uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                  value={editSupplierName}
                                                  onChange={e => setEditSupplierName(e.target.value)}
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[8px] font-black uppercase text-slate-500 block mb-1">Invoice/Bill Number</label>
                                              <input
                                                  type="text"
                                                  className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-205 rounded-xl outline-none uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-indigo-600"
                                                  value={editInvoiceNo}
                                                  placeholder="Type Invoice No."
                                                  onChange={e => setEditInvoiceNo(e.target.value)}
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[8px] font-black uppercase text-slate-500 block mb-1">Invoice Date</label>
                                              <input
                                                  type="text"
                                                  className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-205 rounded-xl outline-none uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                  value={editInvoiceDate}
                                                  placeholder="DD-MM-YYYY"
                                                  onChange={e => setEditInvoiceDate(e.target.value)}
                                              />
                                          </div>
                                      </div>
                                      <div className="flex gap-2 justify-end mt-1">
                                          <button 
                                              onClick={() => setIsEditingInboundInfo(false)} 
                                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-colors"
                                          >
                                              Cancel
                                          </button>
                                          <button 
                                              onClick={async () => {
                                                  const metadataParts = [];
                                                  metadataParts.push(`INV: ${editInvoiceNo || 'N/A'}`);
                                                  metadataParts.push(`DATE: ${editInvoiceDate || 'N/A'}`);
                                                  const formattedSourceName = `${editSupplierName} (${metadataParts.join(', ')})`.toUpperCase().trim();

                                                  setLoading(true);
                                                  const txIds = selectedInbound.items.map(i => i.id);
                                                  const res = await updateGroupedInvoiceDetails(txIds, formattedSourceName);
                                                  setLoading(false);

                                                  if (res.success) {
                                                      setSelectedInbound(prev => prev ? { ...prev, customerName: formattedSourceName } : null);
                                                      setIsEditingInboundInfo(false);
                                                      loadHistory();
                                                  } else {
                                                      alert("Error correcting details: " + res.message);
                                                  }
                                              }} 
                                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-soft"
                                          >
                                              Save Corrections
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                                      <div className="min-w-0 pr-4">
                                          <h3 className="font-black text-slate-900 text-lg uppercase leading-tight truncate max-w-[250px] md:max-w-md tracking-tight">
                                              {parseSupplier(selectedInbound.customerName).supplier}
                                          </h3>
                                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                              {parseSupplier(selectedInbound.customerName).invNo && (
                                                 <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-indigo-600 font-black text-[9px] tracking-wider uppercase flex items-center gap-1">
                                                    <FileText size={10} /> INV NO: {parseSupplier(selectedInbound.customerName).invNo}
                                                 </span>
                                              )}
                                              {parseSupplier(selectedInbound.customerName).invDate && (
                                                 <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-black text-[9px] tracking-wider uppercase">
                                                    DATE: {parseSupplier(selectedInbound.customerName).invDate}
                                                 </span>
                                              )}
                                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                                 Registered: {new Date(selectedInbound.createdAt).toLocaleDateString()}
                                              </span>
                                          </div>
                                      </div>
                                      <button
                                          onClick={() => setIsEditingInboundInfo(true)}
                                          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-soft active:scale-95"
                                      >
                                          <Edit2 size={12} strokeWidth={2.5} className="text-indigo-600" />
                                          Edit Bill Info
                                      </button>
                                  </div>
                              )}
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
                          <div className="flex gap-4">
                              <button 
                                 onClick={() => triggerDeleteBill(selectedInbound)} 
                                 className="px-8 py-5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl active:scale-95 transition-all text-[12px] uppercase tracking-widest shadow-xl flex items-center gap-2"
                              >
                                 <Trash2 size={16} /> Delete Bill
                              </button>
                              <button 
                                 onClick={() => setSelectedInbound(null)} 
                                 className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-all text-[12px] uppercase tracking-widest shadow-xl border border-white/10"
                              >
                                 Terminate Log
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
       )}

       <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => { if (!deletingBill) setShowDeleteConfirm(false); }}
          onConfirm={confirmDeleteBill}
          title="Deduct Stock & Delete Bill"
          message={`Are you sure you want to delete this bill? Deleting this bill will permanently deduct all listed parts (${billToDelete?.items.length || 0} unique SKUs) and their respective quantities from the master stock list.`}
          confirmLabel={deletingBill ? "Deleting..." : "Delete and Update Stock"}
          variant="danger"
          loading={deletingBill}
       />
    </div>
  );
};

export default Purchases;
