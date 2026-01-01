
import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Brand } from '../types';
import DailyTransactions from './DailyTransactions';
import { History, PlusCircle, PackageCheck, FileUp, Upload, CheckCircle2, AlertCircle, Loader2, X, FileSpreadsheet } from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
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

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length < 1) {
        throw new Error("Excel file is empty.");
      }

      // Simple parser: Look for Part Number and Qty
      // Row 0 is often headers
      const parsedRows: any[] = [];
      jsonData.forEach((row, index) => {
        if (index === 0 && isHeaderRow(row)) return;
        
        const partNumber = String(row[0] || '').trim();
        const quantity = parseInt(String(row[1] || '0').replace(/[^0-9]/g, ''));
        const price = parseFloat(String(row[2] || '0').replace(/[^0-9.]/g, ''));

        if (partNumber && !isNaN(quantity) && quantity > 0) {
          parsedRows.push({
            partNumber,
            quantity,
            price: isNaN(price) ? 0 : price,
            name: String(row[3] || 'Excel Import')
          });
        }
      });

      if (parsedRows.length === 0) {
        throw new Error("No valid parts or quantities found in Excel. Ensure column A is Part Number and column B is Quantity.");
      }

      setPreviewData(parsedRows);
    } catch (err: any) {
      setImportLog({ success: false, message: err.message, count: 0 });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const isHeaderRow = (row: any[]) => {
    const first = String(row[0]).toLowerCase();
    return first.includes('part') || first.includes('no') || first.includes('code');
  };

  const confirmBulkImport = async () => {
    if (previewData.length === 0) return;
    setImporting(true);

    const payload = previewData.map(item => ({
      partNumber: item.partNumber,
      type: TransactionType.PURCHASE,
      quantity: item.quantity,
      price: item.price,
      customerName: 'Bulk Excel Import',
      createdByRole: user.role
    }));

    const res = await createBulkTransactions(payload);
    
    if (res.success) {
      setImportLog({ success: true, message: "Successfully imported stock from Excel.", count: payload.length });
      setPreviewData([]);
      // Reload history if needed
    } else {
      setImportLog({ success: false, message: res.message || "Failed to process import.", count: 0 });
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
                <p className="text-xs md:text-sm text-slate-500 font-medium">Add stock manually or via Excel file</p>
             </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <PlusCircle size={16} /> New
             </button>
             <button 
               onClick={() => setActiveTab('IMPORT')}
               className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <FileUp size={16} /> Import Excel
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
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
                  <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center animate-fade-in">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2">Bulk Stock Purchase</h2>
                      <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                        Upload an Excel file to automatically add stock. 
                        Format: <span className="font-mono bg-slate-100 px-1 rounded">Col A: Part No | Col B: Qty | Col C: Price (Optional)</span>
                      </p>
                      
                      <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-blue-200">
                         {importing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                         {importing ? 'Reading File...' : 'Select Excel File'}
                         <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                      </label>
                  </div>
                )}

                {importLog && (
                  <div className={`p-6 rounded-2xl border flex flex-col items-center text-center animate-fade-in ${importLog.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      {importLog.success ? (
                        <CheckCircle2 className="text-green-500 mb-3" size={48} />
                      ) : (
                        <AlertCircle className="text-red-500 mb-3" size={48} />
                      )}
                      <h3 className={`text-lg font-bold ${importLog.success ? 'text-green-900' : 'text-red-900'}`}>
                        {importLog.success ? 'Import Complete' : 'Import Failed'}
                      </h3>
                      <p className={`text-sm mt-1 ${importLog.success ? 'text-green-700' : 'text-red-700'}`}>
                        {importLog.message}
                      </p>
                      {importLog.success && (
                        <div className="mt-4 bg-white px-4 py-2 rounded-lg font-bold text-green-700 border border-green-200">
                          {importLog.count} Items added to stock
                        </div>
                      )}
                      <button 
                        onClick={() => { setImportLog(null); setPreviewData([]); }}
                        className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-800"
                      >
                        Start New Import
                      </button>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col max-h-[70vh]">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/30">
                        <div className="flex items-center gap-3">
                           <div className="bg-blue-600 text-white p-2 rounded-lg">
                              <FileSpreadsheet size={18} />
                           </div>
                           <h3 className="font-bold text-slate-800">Ready to Import ({previewData.length} items)</h3>
                        </div>
                        <button onClick={() => setPreviewData([])} className="text-slate-400 hover:text-red-500">
                           <X size={20} />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest sticky top-0">
                              <tr>
                                 <th className="px-6 py-3">Part Number</th>
                                 <th className="px-6 py-3 text-center">Qty to Add</th>
                                 <th className="px-6 py-3 text-right">Purchase Price</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {previewData.map((row, i) => (
                                 <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-bold text-slate-900">{row.partNumber}</td>
                                    <td className="px-6 py-4 text-center font-bold text-blue-600">+{row.quantity}</td>
                                    <td className="px-6 py-4 text-right text-slate-500">₹{row.price.toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>

                     <div className="p-4 border-t border-slate-100 bg-white">
                        <button 
                          onClick={confirmBulkImport}
                          disabled={importing}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                          {importing ? 'Processing...' : 'Confirm Bulk Purchase'}
                        </button>
                     </div>
                  </div>
                )}
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">
                   <PackageCheck size={18} /> Purchase Log
                </div>

                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No purchase history found.</div>
                  ) : (
                    <>
                    <div className="md:hidden divide-y divide-slate-100">
                        {history.map(tx => (
                            <div key={tx.id} className="p-4 bg-white">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <div className="font-bold text-slate-900 text-base">{tx.partNumber}</div>
                                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-slate-900 text-base">₹{(tx.price * tx.quantity).toLocaleString()}</div>
                                        <div className="text-[10px] text-green-700 font-bold bg-green-50 px-1 rounded inline-block">+{tx.quantity} Stock</div>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 truncate">
                                    Source: {tx.customerName || 'Manual Entry'}
                                </div>
                            </div>
                        ))}
                    </div>

                    <table className="hidden md:table w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Part No</th>
                             <th className="px-6 py-4">Source / Supplier</th>
                             <th className="px-6 py-4 text-center">Qty Added</th>
                             <th className="px-6 py-4 text-right">Unit Price</th>
                             <th className="px-6 py-4 text-right">Total Cost</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {history.map(tx => (
                             <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">
                                   {new Date(tx.createdAt).toLocaleDateString()}
                                   <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                                <td className="px-6 py-4 text-slate-600">{tx.customerName || 'Manual Entry'}</td>
                                <td className="px-6 py-4 text-center font-bold text-green-700">+{tx.quantity}</td>
                                <td className="px-6 py-4 text-right">₹{tx.price.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-900">
                                   ₹{(tx.price * tx.quantity).toLocaleString()}
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
