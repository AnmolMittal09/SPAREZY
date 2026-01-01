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
  ArrowRight
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
      // XLSX.read handles .xlsx, .xls, .xlsb, and .csv
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length < 1) {
        throw new Error("Excel file appears to be empty.");
      }

      // Smart Header Detection
      // Look at the first 3 rows to find headers
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

      // If no headers found, fallback to position-based (Col A: Part, Col B: Qty, Col C: Price)
      if (headerRowIndex === -1) {
        headerRowIndex = 0; // Assume data starts at row 0 if no header found or assume row 0 was a generic header
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
        throw new Error("No valid parts found. Please ensure your file has 'Part Number' and 'Quantity' columns.");
      }

      setPreviewData(parsedRows);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while reading the file.");
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
      setImportLog({ success: true, message: "Inventory successfully updated from file.", count: payload.length });
      setPreviewData([]);
    } else {
      setImportLog({ success: false, message: res.message || "Failed to process bulk import.", count: 0 });
    }
    setImporting(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {/* --- HEADER --- */}
       <div className="bg-white md:bg-transparent px-4 py-3 md:px-0 md:py-0 shadow-sm md:shadow-none z-20 sticky top-0 md:static border-b md:border-none border-slate-100 mb-4">
          <div className="flex justify-between items-center mb-4">
             <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">Purchases</h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium">Restock inventory manually or in bulk</p>
             </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
             <button 
               onClick={() => { setActiveTab('NEW'); setErrorMsg(null); setImportLog(null); }}
               className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <PlusCircle size={16} /> New Entry
             </button>
             <button 
               onClick={() => { setActiveTab('IMPORT'); setErrorMsg(null); setImportLog(null); }}
               className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <FileUp size={16} /> Bulk Import
             </button>
             <button 
               onClick={() => { setActiveTab('HISTORY'); setErrorMsg(null); setImportLog(null); }}
               className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <History size={16} /> History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'NEW' && (
             <DailyTransactions user={user} forcedMode="PURCHASE" />
          )}

          {activeTab === 'IMPORT' && (
             <div className="max-w-4xl mx-auto w-full p-4 space-y-6">
                {!previewData.length && !importLog && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4 items-start">
                        <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                            <Info size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900 text-lg">How to Import</h3>
                            <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                                Upload an Excel or CSV file. The system will automatically detect columns for <b>Part Number</b>, <b>Quantity</b>, and <b>Price</b>. 
                                <br/><span className="text-[10px] uppercase font-black mt-2 block opacity-70">Supported: .xlsx, .xls, .xlsb, .csv</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center hover:border-blue-400 transition-colors group">
                        <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <FileSpreadsheet size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Select Spreadsheet</h2>
                        <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm">
                          Drag and drop your file here or click to browse your computer.
                        </p>
                        
                        <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-xl cursor-pointer transition-all active:scale-95 shadow-xl shadow-blue-200">
                           {importing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                           {importing ? 'Reading...' : 'Choose File'}
                           <input type="file" accept=".xlsx, .xls, .xlsb, .csv" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {errorMsg && (
                           <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-center gap-2 justify-center">
                              <AlertCircle size={18} /> {errorMsg}
                           </div>
                        )}
                    </div>
                  </div>
                )}

                {importLog && (
                  <div className={`p-10 rounded-3xl border flex flex-col items-center text-center animate-fade-in ${importLog.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      <div className={`p-4 rounded-2xl mb-6 ${importLog.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {importLog.success ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                      </div>
                      <h3 className={`text-2xl font-black ${importLog.success ? 'text-green-900' : 'text-red-900'}`}>
                        {importLog.success ? 'Success!' : 'Import Failed'}
                      </h3>
                      <p className={`mt-2 font-medium ${importLog.success ? 'text-green-700/80' : 'text-red-700/80'}`}>
                        {importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
                            <div className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm">
                                <span className="block text-2xl font-black text-green-600">{importLog.count}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items Added</span>
                            </div>
                            <button 
                                onClick={() => setActiveTab('HISTORY')}
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 flex flex-col items-center justify-center transition-all"
                            >
                                <History size={20} className="text-slate-400 mb-1" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">View History</span>
                            </button>
                        </div>
                      )}
                      <button 
                        onClick={() => { setImportLog(null); setPreviewData([]); setErrorMsg(null); }}
                        className="mt-10 text-sm font-bold text-slate-900 hover:underline flex items-center gap-1"
                      >
                        <PlusCircle size={16} /> Start New Import
                      </button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-10 duration-500 flex flex-col max-h-[75vh]">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                        <div className="flex items-center gap-4">
                           <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200">
                              <FileSpreadsheet size={24} />
                           </div>
                           <div>
                              <h3 className="font-black text-slate-900 text-lg leading-tight">Review Import</h3>
                              <p className="text-xs text-slate-500 font-medium">{previewData.length} unique parts detected in file</p>
                           </div>
                        </div>
                        <button onClick={() => setPreviewData([])} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                           <X size={24} />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-400 font-bold uppercase text-[10px] tracking-widest sticky top-0 z-10">
                              <tr>
                                 <th className="px-8 py-4 border-b border-slate-100">Part Details</th>
                                 <th className="px-8 py-4 border-b border-slate-100 text-center">New Stock</th>
                                 <th className="px-8 py-4 border-b border-slate-100 text-right">Unit Cost</th>
                                 <th className="px-8 py-4 border-b border-slate-100 text-right">Total</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {previewData.map((row, i) => (
                                 <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-4">
                                       <div className="font-bold text-slate-900 text-base">{row.partNumber}</div>
                                       <div className="text-xs text-slate-400 font-medium">{row.name}</div>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                       <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 font-black rounded-lg text-sm">
                                          +{row.quantity}
                                       </span>
                                    </td>
                                    <td className="px-8 py-4 text-right font-medium text-slate-600">₹{row.price.toLocaleString()}</td>
                                    <td className="px-8 py-4 text-right font-black text-slate-900">₹{(row.price * row.quantity).toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>

                     <div className="p-6 border-t border-slate-100 bg-white">
                        <button 
                          onClick={confirmBulkImport}
                          disabled={importing}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                          {importing ? 'Processing Transaction...' : `Add ${previewData.length} Items to Stock`}
                        </button>
                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                           Stock levels and purchase history will be updated immediately
                        </p>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white md:rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                      <PackageCheck size={18} /> Purchase Transaction Log
                   </div>
                   <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">Approved Only</span>
                </div>

                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <div className="p-6 bg-slate-50 rounded-full mb-4 text-slate-300">
                           <History size={48} />
                        </div>
                        <p className="font-bold text-slate-900">No Purchase History</p>
                        <p className="text-xs text-slate-500 mt-1">Start by adding stock manually or via import.</p>
                    </div>
                  ) : (
                    <>
                    <div className="md:hidden divide-y divide-slate-100">
                        {history.map(tx => (
                            <div key={tx.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <div className="font-black text-slate-900 text-base leading-tight">{tx.partNumber}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-blue-600 text-base">₹{(tx.price * tx.quantity).toLocaleString()}</div>
                                        <div className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">+{tx.quantity} Stock</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                    Source: <span className="font-bold text-slate-700">{tx.customerName || 'Manual Entry'}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <table className="hidden md:table w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                             <th className="px-6 py-4">Transaction Date</th>
                             <th className="px-6 py-4">Part Number</th>
                             <th className="px-6 py-4">Source / Reference</th>
                             <th className="px-6 py-4 text-center">Qty Added</th>
                             <th className="px-6 py-4 text-right">Unit Price</th>
                             <th className="px-6 py-4 text-right">Total Cost</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {history.map(tx => (
                             <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="text-slate-900 font-bold">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                   <div className="text-[10px] text-slate-400 font-medium">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="font-black text-slate-900">{tx.partNumber}</div>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="text-slate-600 font-medium">{tx.customerName || 'Manual Entry'}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <span className="font-black text-green-700 bg-green-50 px-3 py-1 rounded-lg">+{tx.quantity}</span>
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600 font-medium">₹{tx.price.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                   <div className="font-black text-slate-900">₹{(tx.price * tx.quantity).toLocaleString()}</div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    </>
                  )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;