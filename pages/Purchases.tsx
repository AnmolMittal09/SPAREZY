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
  Database
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'IMPORT' | 'HISTORY'>('NEW');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);

  // Bulk Import State
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<{ success: boolean; message: string; count: number } | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportLog(null);
    setPreviewData([]);
    setErrorMsg(null);

    try {
      const data = await file.arrayBuffer();
      // XLSX.read handles .xlsx, .xlsb, .xlsm, .xls, .csv automatically when type is array
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length < 1) {
        throw new Error("Spreadsheet appears to be empty.");
      }

      let headerRowIndex = -1;
      let colMap = { partNumber: -1, quantity: -1, price: -1, name: -1 };

      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i].map(c => String(c || '').toLowerCase().trim());
        const pIdx = row.findIndex(c => c.includes('part') || c.includes('sku') || c.includes('item no') || c.includes('code'));
        const qIdx = row.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('stock') || c.includes('units'));
        const prIdx = row.findIndex(c => c.includes('price') || c.includes('mrp') || c.includes('rate') || c.includes('cost'));
        const nIdx = row.findIndex(c => c.includes('name') || c.includes('desc') || c.includes('detail'));

        if (pIdx !== -1 && qIdx !== -1) {
          headerRowIndex = i;
          colMap = { partNumber: pIdx, quantity: qIdx, price: prIdx, name: nIdx };
          break;
        }
      }

      if (headerRowIndex === -1) {
        headerRowIndex = 0;
        colMap = { partNumber: 0, quantity: 1, price: 2, name: 3 };
      }

      const parsedRows: any[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const partNumber = String(row[colMap.partNumber] || '').trim();
        const rawQty = row[colMap.quantity];
        const quantity = typeof rawQty === 'number' ? rawQty : parseInt(String(rawQty || '0').replace(/[^0-9]/g, ''));
        
        const rawPrice = colMap.price !== -1 ? row[colMap.price] : 0;
        const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0').replace(/[^0-9.]/g, ''));
        
        const name = colMap.name !== -1 ? String(row[colMap.name] || '') : 'Excel Import';

        if (partNumber && !isNaN(quantity) && quantity > 0) {
          parsedRows.push({
            partNumber,
            quantity,
            price: isNaN(price) ? 0 : price,
            name: name
          });
        }
      }

      if (parsedRows.length === 0) {
        throw new Error("No valid data found. Ensure columns like 'Part Number' and 'Quantity' exist.");
      }

      setPreviewData(parsedRows);
    } catch (err: any) {
      setErrorMsg(err.message || "Error parsing spreadsheet.");
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
      price: item.price,
      customerName: `Bulk Import (${new Date().toLocaleDateString()})`,
      createdByRole: user.role
    }));

    const res = await createBulkTransactions(payload);
    
    if (res.success) {
      setImportLog({ success: true, message: "Inventory successfully updated.", count: payload.length });
      setPreviewData([]);
    } else {
      setImportLog({ success: false, message: res.message || "Bulk import failed.", count: 0 });
    }
    setImporting(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] md:bg-transparent">
       
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button 
                 onClick={() => { setActiveTab('NEW'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}
               >
                 Direct In
               </button>
               <button 
                 onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
               >
                 Excel
               </button>
               <button 
                 onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}
               >
                 Log
               </button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Purchasing</h1>
             <p className="text-slate-500 font-medium">Replenish your inventory via manual entry or bulk excel files.</p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <PlusCircle size={18} /> Manual Entry
             </button>
             <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <FileUp size={18} /> Bulk Spreadsheet
             </button>
             <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <History size={18} /> Purchase Logs
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && (
             <DailyTransactions 
                user={user} 
                forcedMode="PURCHASE" 
                onSearchToggle={setIsSearchingOnMobile} 
             />
          )}

          {activeTab === 'IMPORT' && (
             <div className="max-w-3xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col h-full overflow-y-auto no-scrollbar">
                {!previewData.length && !importLog && (
                  <div className="space-y-6 animate-fade-in pb-12">
                    <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8 flex gap-5 items-start shadow-sm">
                        <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-100 flex-none">
                            <Database size={28} />
                        </div>
                        <div>
                            <h3 className="font-black text-blue-900 text-lg uppercase tracking-tight">Enterprise Bulk Inbound</h3>
                            <p className="text-[14px] text-blue-700/80 mt-2 leading-relaxed font-medium">
                                Fast-track your stock arrival. Upload supplier invoices or order sheets in <b>Excel, XLSB, or CSV</b> format. 
                                Our engine automatically updates part quantities and costs.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-12 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all group shadow-soft relative overflow-hidden">
                        <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner">
                          <FileSpreadsheet size={44} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Import Data</h2>
                        <p className="text-slate-400 mb-10 max-w-xs mx-auto text-[14px] font-bold leading-relaxed">
                          All formats supported: .xlsx, .xls, .xlsb, .xlsm, .csv
                        </p>
                        
                        <label className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-2xl shadow-blue-200 uppercase text-[13px] tracking-widest">
                           {importing ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
                           {importing ? 'Syncing...' : 'Select File'}
                           <input type="file" accept=".xlsx, .xls, .xlsb, .xlsm, .csv" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {errorMsg && (
                           <div className="mt-10 p-5 bg-red-50 text-red-600 rounded-3xl border border-red-100 text-sm font-black flex items-center gap-3 justify-center animate-shake">
                              <AlertCircle size={20} /> {errorMsg}
                           </div>
                        )}
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
                        {importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-12 grid grid-cols-2 gap-5 w-full">
                            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                <span className="block text-4xl font-black text-slate-900 tracking-tighter">{importLog.count}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1 block">SKUs Synced</span>
                            </div>
                            <button 
                                onClick={() => setActiveTab('HISTORY')}
                                className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center transition-all active:scale-95"
                            >
                                <History size={28} className="mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-[0.25em]">Review Log</span>
                            </button>
                        </div>
                      )}
                      <button 
                        onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); }}
                        className="mt-14 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-600 transition-colors"
                      >
                        Start New Upload
                      </button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[85vh] mb-12">
                     <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <div className="flex items-center gap-5">
                           <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl shadow-blue-100">
                              <TrendingUp size={28} />
                           </div>
                           <div>
                              <h3 className="font-black text-slate-900 text-xl leading-none mb-2">Syncing {previewData.length} Parts</h3>
                              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">Incoming Stock Verification</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-3 text-slate-300 hover:text-rose-500 bg-white rounded-2xl shadow-sm transition-all active:scale-90">
                           <X size={24} />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 no-scrollbar bg-slate-50/30">
                        {/* MOBILE OPTIMIZED CARD PREVIEW */}
                        {previewData.map((row, i) => (
                           <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                              <div className="flex-1 min-w-0 pr-4">
                                 <div className="font-black text-slate-900 text-base leading-tight tracking-tight mb-1">{row.partNumber}</div>
                                 <div className="text-[12px] text-slate-400 font-bold truncate">{row.name}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <div className="text-right">
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">New Qty</div>
                                    <div className="font-black text-slate-900 text-lg">+{row.quantity}</div>
                                 </div>
                                 <ChevronRight size={18} className="text-slate-200 group-hover:text-blue-500" />
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0">
                        <div className="flex justify-between items-center mb-6 px-2">
                           <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ready for database Sync</span>
                           <span className="font-black text-slate-900 text-sm">{previewData.length} Items</span>
                        </div>
                        <button 
                          onClick={confirmBulkImport}
                          disabled={importing}
                          className="w-full bg-slate-900 hover:bg-black text-white font-black py-5.5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center justify-center gap-4 active:scale-[0.98] transition-all disabled:opacity-50 text-[16px] uppercase tracking-widest"
                        >
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />}
                          Verify & Sync Inbound
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
                         <span className="font-black text-slate-900 text-xl tracking-tight block">Sync Journal</span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbound Stock Ledger</span>
                      </div>
                   </div>
                   <button onClick={loadHistory} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
                      <Clock size={20} />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 no-scrollbar pb-32">
                  {loading ? (
                    <div className="flex justify-center p-20"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-soft">
                           <History size={48} className="opacity-10" />
                        </div>
                        <p className="font-black text-xs uppercase tracking-[0.3em]">Purchase Log Empty</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map(tx => (
                            <div key={tx.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-premium animate-fade-in relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-3 h-full bg-blue-600/10 group-hover:bg-blue-600/20 transition-all"></div>
                                <div className="flex justify-between items-start mb-5">
                                    <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                                        <div className="font-black text-slate-900 text-lg leading-tight tracking-tight truncate">{tx.partNumber}</div>
                                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                            <Calendar size={12} className="text-slate-300" /> {new Date(tx.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">|</span>
                                            <Clock size={12} className="text-slate-300" /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-sm">
                                        +{tx.quantity} units
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-slate-50 flex justify-between items-end">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1.5">Source Reference</p>
                                        <p className="text-[13px] font-bold text-slate-700 truncate">{tx.customerName || 'Inbound Entry'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Unit Value</p>
                                        <p className="text-xl font-black text-slate-900 tracking-tighter">₹{tx.price.toLocaleString()}</p>
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
    </div>
  );
};

export default Purchases;