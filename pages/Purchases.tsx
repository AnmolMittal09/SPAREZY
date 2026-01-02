import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType } from '../types';
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
  Percent
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { extractInvoiceData } from '../services/geminiService';
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

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'IMPORT' | 'HISTORY'>('NEW');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);

  // Bulk Import State
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ success: boolean; message: string; count: number; totalValue: number; errorCount: number } | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const STANDARD_DISCOUNT = 12;

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.PURCHASE);
    setHistory(data);
    setLoading(false);
  };

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

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrorMsg(null);
    setPreviewData([]);
    setImportLog(null);

    try {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        const extracted = await extractInvoiceData(base64, file.type);
        
        if (extracted && extracted.length > 0) {
          // Process verification logic with 12% rules
          const verifiedItems = extracted.map((item: any) => {
            const expectedPriceAt12Percent = item.mrp * (1 - (STANDARD_DISCOUNT / 100));
            const diff = Math.abs(expectedPriceAt12Percent - item.printedUnitPrice);
            
            let hasError = false;
            let errorType: 'DISCOUNT_LOW' | 'CALC_MISMATCH' | 'NONE' = 'NONE';

            if (item.discountPercent < STANDARD_DISCOUNT) {
              hasError = true;
              errorType = 'DISCOUNT_LOW';
            } else if (diff > 0.5) {
              hasError = true;
              errorType = 'CALC_MISMATCH';
            }

            return {
              ...item,
              calculatedPrice: parseFloat(expectedPriceAt12Percent.toFixed(2)),
              hasError,
              errorType,
              diff: parseFloat((item.printedUnitPrice - expectedPriceAt12Percent).toFixed(2))
            };
          });
          setPreviewData(verifiedItems);
        } else {
          throw new Error("No items detected in invoice.");
        }
      } else if (file.name.match(/\.(xlsx|xls|xlsb|xlsm|csv)$/i)) {
        const data = await file.arrayBuffer();
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

          if (disc < STANDARD_DISCOUNT) {
            hasError = true;
            errorType = 'DISCOUNT_LOW';
          } else if (Math.abs(printed - calculatedAt12) > 0.5) {
            hasError = true;
            errorType = 'CALC_MISMATCH';
          }

          return {
            partNumber: String(row[0] || ''),
            name: String(row[1] || 'Excel Row'),
            quantity: Number(row[5] || 1),
            mrp,
            discountPercent: disc,
            printedUnitPrice: printed,
            calculatedPrice: calculatedAt12,
            hasError,
            errorType,
            diff: printed - calculatedAt12
          };
        }).filter(i => i.partNumber && i.quantity > 0);
        
        setPreviewData(parsed as any);
      } else {
        throw new Error("Invalid file format.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Extraction failed.");
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const confirmBulkImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);

    const payload = previewData.map(item => ({
      partNumber: item.partNumber,
      type: TransactionType.PURCHASE,
      quantity: item.quantity,
      price: item.printedUnitPrice,
      customerName: `AI Audit Scan (${new Date().toLocaleDateString()})`,
      createdByRole: user.role
    }));

    const res = await createBulkTransactions(payload);
    
    if (res.success) {
      const total = payload.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const errorCount = previewData.filter(i => i.hasError).length;
      setImportLog({ 
        success: true, 
        message: "Stock successfully updated.", 
        count: payload.length,
        totalValue: total,
        errorCount
      });
      setPreviewData([]);
    } else {
      setImportLog({ success: false, message: res.message || "Sync failed.", count: 0, totalValue: 0, errorCount: 0 });
    }
    setImporting(false);
  };

  const shareToWhatsApp = () => {
    if (!importLog) return;
    
    const summary = `🚀 *Sparezy Inbound Verification*\n\n` +
      `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
      `📦 *Items:* ${importLog.count}\n` +
      `💰 *Total:* ₹${importLog.totalValue.toLocaleString()}\n` +
      `📏 *Standard B.DC:* ${STANDARD_DISCOUNT}%\n` +
      `⚠️ *Discrepancies:* ${importLog.errorCount === 0 ? 'None (Verified ✅)' : importLog.errorCount + ' Issues Found 🚨'}\n\n` +
      `_Automated AI verification completed._`;
      
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] md:bg-transparent">
       
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Entry</button>
               <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>Bill Scan</button>
               <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Log</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Purchase Inbound</h1>
             <p className="text-slate-500 font-medium">Verify bill against standard 12% discount rule.</p>
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
                            <h3 className="font-black text-blue-900 text-lg uppercase tracking-tight">Audit: 12% B.DC Rule</h3>
                            <p className="text-[14px] text-blue-700/80 mt-2 leading-relaxed font-medium">
                                Upload your bill. Sparezy will verify if every item has at least <b>12% B.DC</b> and if the <b>Net Price</b> calculation is correct based on MRP.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-12 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all group shadow-soft">
                        {importing ? (
                          <div className="py-8"><TharLoader /><p className="mt-8 font-black text-blue-600 animate-pulse text-sm uppercase tracking-widest">Auditing Bill Calculations...</p></div>
                        ) : (
                          <>
                            <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner"><FileText size={44} /></div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Import Invoice</h2>
                            <p className="text-slate-400 mb-10 max-w-xs mx-auto text-[14px] font-bold">PDF / Images / Excel supported</p>
                            <label className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-2xl shadow-blue-200 uppercase text-[13px] tracking-widest">
                               <Upload size={24} /> Select Bill File
                               <input type="file" accept="application/pdf, image/*, .xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleInvoiceUpload} />
                            </label>
                          </>
                        )}
                        {errorMsg && <div className="mt-10 p-5 bg-red-50 text-red-600 rounded-3xl border border-red-100 text-sm font-black flex items-center gap-3 justify-center animate-shake"><AlertCircle size={20} /> {errorMsg}</div>}
                    </div>
                  </div>
                )}

                {importLog && (
                  <div className={`p-10 rounded-[3rem] border-2 flex flex-col items-center text-center animate-slide-up shadow-2xl bg-white ${importLog.success ? 'border-green-100' : 'border-red-100'}`}>
                      <div className={`w-24 h-24 rounded-full mb-8 flex items-center justify-center shadow-xl ${importLog.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {importLog.success ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                      </div>
                      <h3 className={`text-3xl font-black ${importLog.success ? 'text-slate-900' : 'text-red-900'}`}>
                        {importLog.success ? 'Import Complete' : 'Process Halted'}
                      </h3>
                      <p className="mt-4 font-bold text-slate-400 text-base max-w-sm leading-relaxed">
                         {importLog.success ? `Stock updated. ${importLog.errorCount > 0 ? `Alert: Detected ${importLog.errorCount} discrepancies in bill math or discount rules.` : 'Audit passed: All items follow 12% rule.'}` : importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-12 space-y-4 w-full">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                    <span className="block text-3xl font-black text-slate-900">{importLog.count}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1 block">SKUs Synced</span>
                                </div>
                                <div className="bg-blue-50 p-6 rounded-[2.5rem] border border-blue-100 shadow-inner">
                                    <span className="block text-2xl font-black text-blue-900">₹{importLog.totalValue.toLocaleString()}</span>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.25em] mt-1 block">Net Value</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={shareToWhatsApp} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-5 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"><MessageCircle size={24} /> Share Audit Summary</button>
                                <button onClick={() => setActiveTab('HISTORY')} className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl transition-all active:scale-95"><History size={24} /></button>
                            </div>
                        </div>
                      )}
                      <button onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); }} className="mt-14 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-600 transition-colors">Start New Scan</button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
                     <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <div className="flex items-center gap-5">
                           <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl shadow-blue-100"><ShieldCheck size={28} /></div>
                           <div>
                              <h3 className="font-black text-slate-900 text-xl leading-none mb-2">Audit: {previewData.length} Items</h3>
                              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">Verification Rule: {STANDARD_DISCOUNT}% B.DC</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-3 text-slate-300 hover:text-rose-500 bg-white rounded-2xl shadow-sm transition-all active:scale-90"><X size={24} /></button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/30">
                        {previewData.map((row, i) => (
                           <div key={i} className={`bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 animate-fade-in ${row.hasError ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                              <div className="flex justify-between items-start">
                                 <div className="flex-1 min-w-0 pr-4">
                                    <div className="font-black text-slate-900 text-lg leading-tight tracking-tight mb-1">{row.partNumber}</div>
                                    <div className="text-[12px] text-slate-400 font-bold truncate">{row.name}</div>
                                 </div>
                                 <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm">+{row.quantity} Qty</div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100/50">
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">MRP</p>
                                    <p className="font-bold text-slate-900">₹{row.mrp.toLocaleString()}</p>
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B.DC Detected</p>
                                    <p className={`font-bold ${row.errorType === 'DISCOUNT_LOW' ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {row.discountPercent}%
                                      {row.errorType === 'DISCOUNT_LOW' && <span className="text-[9px] block">Less than {STANDARD_DISCOUNT}%!</span>}
                                    </p>
                                 </div>
                                 <div className="md:text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bill Unit Price</p>
                                    <p className={`font-black text-lg ${row.hasError ? 'text-rose-600' : 'text-teal-600'}`}>₹{row.printedUnitPrice.toLocaleString()}</p>
                                 </div>
                              </div>

                              {row.hasError && (
                                 <div className="bg-rose-100/50 p-4 rounded-2xl border border-rose-200 flex gap-3 items-center">
                                    <AlertTriangle className="text-rose-600" size={20} />
                                    <div className="text-[12px] font-bold text-rose-800 leading-tight">
                                       {row.errorType === 'DISCOUNT_LOW' ? (
                                          <p>Error: Bill discount ({row.discountPercent}%) is lower than standard ({STANDARD_DISCOUNT}%).</p>
                                       ) : (
                                          <p>Price Mismatch! At {STANDARD_DISCOUNT}% B.DC, expected ₹{row.calculatedPrice.toLocaleString()}</p>
                                       )}
                                       <p className="opacity-70 mt-1">Discrepancy of ₹{row.diff.toLocaleString()} detected per unit.</p>
                                    </div>
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>

                     <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0">
                        <button onClick={confirmBulkImport} disabled={importing} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5.5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center justify-center gap-4 active:scale-[0.98] transition-all disabled:opacity-50 text-[16px] uppercase tracking-widest">
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} Confirm Audit & Sync
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-[3rem] shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100"><Truck size={24} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-xl tracking-tight block">Inbound Log</span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Purchase History</span>
                      </div>
                   </div>
                   <button onClick={loadHistory} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all"><Clock size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 no-scrollbar pb-32">
                  {loading ? <div className="flex justify-center p-20"><TharLoader /></div> : history.length === 0 ? <div className="flex flex-col items-center justify-center py-32 text-slate-300"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-soft"><History size={48} className="opacity-10" /></div><p className="font-black text-xs uppercase tracking-[0.3em]">No history found</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map(tx => (
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
                        ))}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;