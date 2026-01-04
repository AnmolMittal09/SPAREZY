import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, FileText, DollarSign, Package, History, Undo2, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { updateOrAddItems, UpdateResult, fetchUploadHistory, revertUploadBatch } from '../services/inventoryService';
import { Brand, StockItem, UploadHistoryEntry } from '../types';
import { triggerAutoRefresh } from '../services/refreshService';
import * as XLSX from 'xlsx';
import TharLoader from '../components/TharLoader';

type UploadMode = 'MASTER' | 'STOCK';

const UploadPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'history'>('file');
  const [textData, setTextData] = useState('');
  const [log, setLog] = useState<UpdateResult | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetBrand, setTargetBrand] = useState<Brand>(Brand.HYUNDAI);
  const [uploadMode, setUploadMode] = useState<UploadMode>('MASTER');
  
  const [historyList, setHistoryList] = useState<UploadHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const data = await fetchUploadHistory();
    setHistoryList(data);
    setLoadingHistory(false);
  };

  const handleRevert = async (entry: UploadHistoryEntry) => {
    if (!window.confirm(`Are you sure you want to revert the upload "${entry.fileName}"?`)) return;
    setRevertingId(entry.id);
    const res = await revertUploadBatch(entry.id);
    if (res.success) {
      triggerAutoRefresh(500);
    } else {
      alert(res.message);
      setRevertingId(null);
    }
  };

  const processRowData = async (rows: any[][], fileName: string = 'Manual Paste') => {
    const parsedItems: Partial<StockItem>[] = [];
    rows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        const partNumber = String(row[0] || '').trim();
        if (!partNumber || ['part no', 'part number'].includes(partNumber.toLowerCase())) return;

        let name = '', hsnCode = '', price, quantity;
        if (uploadMode === 'MASTER') {
            name = String(row[1] || '').trim();
            hsnCode = String(row[2] || '').trim();
            price = parseFloat(String(row[3] || '').replace(/[^0-9.]/g, ''));
        } else {
            quantity = parseInt(String(row[1] || '').replace(/[^0-9]/g, ''));
        }

        parsedItems.push({ partNumber, name: name || undefined, brand: targetBrand, hsnCode: hsnCode || undefined, quantity, price });
    });

    if (parsedItems.length === 0) {
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: ['No valid data rows found.'] });
        setIsProcessing(false);
        return;
    }

    const result = await updateOrAddItems(parsedItems, { fileName, mode: uploadMode });
    setLog(result);
    setIsProcessing(false);
    if (result.added > 0 || result.updated > 0) {
        triggerAutoRefresh(1500); // Give user time to see results
    }
  };

  const handlePasteProcess = async () => {
    setIsProcessing(true);
    const rows = textData.trim().split('\n').map(row => row.split(/[\t,]+/).map(c => c.trim()));
    await processRowData(rows);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLog(null);
    try {
        if (file.name.toLowerCase().endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const text = evt.target?.result as string;
                const rows = text.trim().split('\n').map(row => row.split(',').map(c => c.trim()));
                await processRowData(rows, file.name);
            };
            reader.readAsText(file);
        } else if (file.name.match(/\.(xlsx|xls|xlsb|xlsm)$/i)) {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
            await processRowData(jsonData, file.name);
        }
    } catch (error: any) { alert(error.message); setIsProcessing(false); }
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Update Stock & Prices</h1>
            <p className="text-gray-500 text-sm">Central Registry Sync Engine</p>
          </div>
          {isProcessing && <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase animate-pulse"><RefreshCw size={14} className="animate-spin"/> Syncing Registry...</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Select Brand</h3>
            <div className="flex gap-3">
                <button onClick={() => setTargetBrand(Brand.HYUNDAI)} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${targetBrand === Brand.HYUNDAI ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>Hyundai</button>
                <button onClick={() => setTargetBrand(Brand.MAHINDRA)} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${targetBrand === Brand.MAHINDRA ? 'bg-red-600 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>Mahindra</button>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">2. Select File Content</h3>
            <div className="flex gap-3">
                <button onClick={() => setUploadMode('MASTER')} className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center ${uploadMode === 'MASTER' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>
                    <span className="flex items-center gap-1"><DollarSign size={14}/> Price List</span>
                    <span className="text-[10px] opacity-70 font-normal">MRP Updates</span>
                </button>
                <button onClick={() => setUploadMode('STOCK')} className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center ${uploadMode === 'STOCK' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>
                    <span className="flex items-center gap-1"><Package size={14}/> Stock List</span>
                    <span className="text-[10px] opacity-70 font-normal">Qty Updates</span>
                </button>
            </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 flex">
            <button onClick={() => setActiveTab('file')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'file' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>File Upload</button>
            <button onClick={() => setActiveTab('paste')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'paste' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>Paste Data</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>History</button>
        </div>
        <div className="p-8">
            {activeTab === 'history' ? (
              <div className="space-y-4">
                 {loadingHistory ? <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div> : historyList.length === 0 ? <p className="text-center text-gray-400 py-8">No history.</p> : (
                   <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                           <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {historyList.map(entry => (
                             <tr key={entry.id} className={entry.status === 'REVERTED' ? 'bg-red-50 opacity-75' : ''}>
                                <td className="px-4 py-3 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3 font-medium">{entry.fileName}</td>
                                <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded bg-gray-200">{entry.uploadMode}</span></td>
                                <td className="px-4 py-3 text-right">
                                   {entry.status === 'REVERTED' ? <span className="text-xs font-bold text-red-600">REVERTED</span> : <button onClick={() => handleRevert(entry)} disabled={!!revertingId} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center justify-end gap-1 w-full disabled:opacity-50">{revertingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Undo</button>}
                                </td>
                             </tr>
                           ))}
                        </tbody>
                   </table>
                 )}
              </div>
            ) : activeTab === 'file' ? (
                <div className="border-2 border-dashed border-blue-200 rounded-xl p-12 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><UploadIcon size={32} /></div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Upload {targetBrand} {uploadMode}</h3>
                    <p className="text-sm text-gray-500 mb-6">Excel or CSV files</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg cursor-pointer shadow-sm">Select File<input type="file" accept=".csv, .xlsx, .xls, .xlsb" onChange={handleFileUpload} className="hidden"/></label>
                </div>
            ) : (
                <div className="space-y-4">
                    <textarea value={textData} onChange={e => setTextData(e.target.value)} placeholder="PartNo, DataValue..." className="w-full h-64 p-4 border border-gray-200 rounded-lg font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button onClick={handlePasteProcess} disabled={!textData || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}{isProcessing ? 'Processing...' : 'Process Data'}</button>
                </div>
            )}
        </div>
      </div>

      {log && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in text-center">
            <h3 className="font-bold text-gray-900 flex items-center justify-center gap-2 text-lg mb-6"><CheckCircle className="text-green-500" size={24} /> Registry Synced Successfully</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-xl border border-green-100"><span className="block text-3xl font-bold text-green-700">{log.added}</span><span className="text-xs font-bold uppercase text-green-800 tracking-wide mt-1">New Items</span></div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><span className="block text-3xl font-bold text-gray-700">{log.updated}</span><span className="text-xs font-bold uppercase text-gray-600 tracking-wide mt-1">Items Touched</span></div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><span className="block text-3xl font-bold text-blue-700">{log.priceUpdates}</span><span className="text-xs font-bold uppercase text-blue-800 tracking-wide mt-1">Price Updates</span></div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><span className="block text-3xl font-bold text-purple-700">{log.stockUpdates}</span><span className="text-xs font-bold uppercase text-purple-800 tracking-wide mt-1">Stock Updates</span></div>
            </div>
            <p className="mt-8 text-xs font-bold text-brand-600 animate-pulse tracking-widest uppercase">System will refresh in 1s to reflect all changes...</p>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
