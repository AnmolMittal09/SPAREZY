import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType } from '../types';
import DailyTransactions from './DailyTransactions';
// Added missing Clock icon to imports
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
  Clock
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
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length < 1) {
        throw new Error("Excel file appears to be empty.");
      }

      let headerRowIndex = -1;
      let colMap = { partNumber: -1, quantity: -1, price: -1, name: -1 };

      for (let i = 0; i < Math.min(3, jsonData.length); i++) {
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
        throw new Error("No valid parts found. Check 'Part Number' and 'Quantity' columns.");
      }

      setPreviewData(parsedRows);
    } catch (err: any) {
      setErrorMsg(err.message || "Error reading file.");
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
      customerName: `Bulk Stock-In (${new Date().toLocaleDateString()})`,
      createdByRole: user.role
    }));

    const res = await createBulkTransactions(payload);
    
    if (res.success) {
      setImportLog({ success: true, message: "Stock successfully imported.", count: payload.length });
      setPreviewData([]);
    } else {
      setImportLog({ success: false, message: res.message || "Failed to process import.", count: 0 });
    }
    setImporting(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {/* --- MOBILE HEADER & TABS - HIDDEN WHEN SEARCHING --- */}
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button 
                 onClick={() => { setActiveTab('NEW'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-800' : 'text-slate-400'}`}
               >
                 Stock In
               </button>
               <button 
                 onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-500' : 'text-slate-400'}`}
               >
                 Import
               </button>
               <button 
                 onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); setImportLog(null); }}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-800' : 'text-slate-400'}`}
               >
                 Logs
               </button>
            </div>
         </div>
       )}

       {/* --- DESKTOP HEADER --- */}
       <div className="hidden md:flex justify-between items-center mb-6">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inventory Purchasing</h1>
             <p className="text-slate-500 font-medium">Add stock from suppliers and company invoices.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft w-fit">
             <button onClick={() => { setActiveTab('NEW'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <PlusCircle size={18} /> Manual In
             </button>
             <button onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <FileUp size={18} /> Bulk Import
             </button>
             <button onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); setImportLog(null); }} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <History size={18} /> Stock Logs
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
             <div className="max-w-3xl mx-auto w-full p-4 space-y-6">
                {!previewData.length && !importLog && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                            <Info size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-blue-900 text-base uppercase tracking-tight">Bulk Stock Import</h3>
                            <p className="text-[13px] text-blue-700/80 mt-1 leading-relaxed">
                                Upload your supplier sheet (.xlsx / .csv). 
                                We'll automatically identify part numbers and update your counts.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center hover:border-blue-400 transition-all group shadow-soft">
                        <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner">
                          <FileSpreadsheet size={36} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 mb-2">Select Spreadsheet</h2>
                        <p className="text-slate-400 mb-8 max-w-xs mx-auto text-[13px] font-medium leading-relaxed">
                          Choose an Excel or CSV file from your device to begin.
                        </p>
                        
                        <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-10 py-4.5 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-xl shadow-blue-200 uppercase text-xs tracking-widest">
                           {importing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                           {importing ? 'Processing...' : 'Pick File'}
                           <input type="file" accept=".xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {errorMsg && (
                           <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-xs font-bold flex items-center gap-2 justify-center">
                              <AlertCircle size={16} /> {errorMsg}
                           </div>
                        )}
                    </div>
                  </div>
                )}

                {importLog && (
                  <div className={`p-10 rounded-[2.5rem] border flex flex-col items-center text-center animate-slide-up shadow-xl ${importLog.success ? 'bg-white border-green-100' : 'bg-white border-red-100'}`}>
                      <div className={`w-20 h-20 rounded-full mb-6 flex items-center justify-center shadow-lg ${importLog.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {importLog.success ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                      </div>
                      <h3 className={`text-2xl font-black ${importLog.success ? 'text-slate-900' : 'text-red-900'}`}>
                        {importLog.success ? 'Stock Updated' : 'Import Failed'}
                      </h3>
                      <p className="mt-3 font-bold text-slate-400 text-sm max-w-xs leading-relaxed">
                        {importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-10 grid grid-cols-2 gap-4 w-full">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                                <span className="block text-3xl font-black text-slate-900">{importLog.count}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">SKUs Processed</span>
                            </div>
                            <button 
                                onClick={() => setActiveTab('HISTORY')}
                                className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center transition-all active:scale-95"
                            >
                                <History size={24} className="mb-2" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">View History</span>
                            </button>
                        </div>
                      )}
                      <button 
                        onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); }}
                        className="mt-12 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-600 transition-colors"
                      >
                        Start Another Import
                      </button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
                     <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                        <div className="flex items-center gap-4">
                           <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-100">
                              <TrendingUp size={24} />
                           </div>
                           <div>
                              <h3 className="font-black text-slate-900 text-base leading-none mb-1">Stock Inbound</h3>
                              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{previewData.length} parts found</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                           <X size={24} />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-white text-slate-300 font-black uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-slate-50">
                              <tr>
                                 <th className="px-6 py-4">Part No</th>
                                 <th className="px-6 py-4 text-center">New Qty</th>
                                 <th className="px-6 py-4 text-right">Cost</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {previewData.map((row, i) => (
                                 <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                       <div className="font-black text-slate-900 text-sm leading-tight">{row.partNumber}</div>
                                       <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{row.name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       <span className="inline-flex items-center px-3 py-1 bg-teal-50 text-teal-600 font-black rounded-lg text-xs">
                                          +{row.quantity}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">₹{row.price.toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>

                     <div className="p-6 border-t border-slate-50 bg-white">
                        <button 
                          onClick={confirmBulkImport}
                          disabled={importing}
                          className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[1.5rem] shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 text-sm uppercase tracking-widest"
                        >
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                          Confirm Inbound
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl"><Truck size={18} /></div>
                      <span className="font-black text-slate-900 text-base uppercase tracking-tight">Stock-In Ledger</span>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-24">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                        <AlertCircle size={64} className="mb-4 opacity-10" />
                        <p className="font-black text-xs uppercase tracking-widest">No stock entries found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {history.map(tx => (
                            <div key={tx.id} className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-fade-in relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-full bg-blue-500/10 transition-all group-hover:w-3"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <div className="font-black text-slate-900 text-lg leading-tight">{tx.partNumber}</div>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold">
                                            <Calendar size={12} /> {new Date(tx.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">|</span>
                                            <Clock size={12} /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        +{tx.quantity} units
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-between items-end border-t border-slate-50 pt-4">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Source Ref</p>
                                        <p className="text-[13px] font-bold text-slate-700 truncate">{tx.customerName || 'Manual Entry'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Unit Value</p>
                                        <p className="text-base font-black text-slate-900 tracking-tight">₹{tx.price.toLocaleString()}</p>
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