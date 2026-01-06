
import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, FileText, DollarSign, Package, History, Undo2, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { updateOrAddItems, UpdateResult, fetchUploadHistory, revertUploadBatch } from '../services/inventoryService';
import { Brand, StockItem, UploadHistoryEntry } from '../types';
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
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchUploadHistory();
      setHistoryList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRevert = async (entry: UploadHistoryEntry) => {
    if (!window.confirm(`Are you sure you want to revert the upload "${entry.fileName}"?`)) return;
    setRevertingId(entry.id);
    const res = await revertUploadBatch(entry.id);
    if (res.success) {
      alert("Changes reverted successfully.");
      loadHistory();
    } else {
      alert(res.message);
    }
    setRevertingId(null);
  };

  const processRowData = async (rows: any[][], fileName: string = 'Manual Paste') => {
    const parsedItems: Partial<StockItem>[] = [];
    const localErrors: string[] = [];
    const localWarnings: string[] = [];
    const seenPartNumbers = new Set<string>();
    
    let validPricesFound = 0;
    let validQuantitiesFound = 0;

    rows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        
        const firstCell = String(row[0] || '').toLowerCase().trim();
        if (['part no', 'part number', 'part_no', 'code', 'sl no', 's.no'].includes(firstCell)) return;

        let partNumber = String(row[0] || '').toUpperCase().trim();
        if (!partNumber) {
            localErrors.push(`Row ${index + 1}: Skipped - Missing Part Number`);
            return; 
        }

        if (seenPartNumbers.has(partNumber)) {
            localWarnings.push(`Row ${index + 1}: Duplicate "${partNumber}" in file. Using latest.`);
        }
        seenPartNumbers.add(partNumber);

        let name = '';
        let hsnCode = '';
        let price: number | undefined = undefined;
        let quantity: number | undefined = undefined;

        if (uploadMode === 'MASTER') {
            name = String(row[1] || '').trim();
            hsnCode = String(row[2] || '').trim(); 
            const rawPrice = row[3];
            if (rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== '') {
                const parsed = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
                if (!isNaN(parsed)) { price = parsed; validPricesFound++; }
            }
        } else {
            const col1 = row[1];
            const col2 = row[2];
            let quantityRaw = col1;
            const isCol2Number = col2 !== undefined && col2 !== null && String(col2).trim() !== '' && !isNaN(Number(col2));
            const isCol1Number = col1 !== undefined && col1 !== null && String(col1).trim() !== '' && !isNaN(Number(col1));
            if (isCol2Number && !isCol1Number) { quantityRaw = col2; }

            if (quantityRaw !== undefined && quantityRaw !== null && String(quantityRaw).trim() !== '') {
                const parsed = parseInt(String(quantityRaw).replace(/[^0-9-]/g, ''));
                if (!isNaN(parsed)) { quantity = parsed; validQuantitiesFound++; }
            }
        }

        parsedItems.push({ partNumber, name: name || undefined, brand: targetBrand, hsnCode: hsnCode || undefined, quantity, price });
    });

    if (parsedItems.length === 0) {
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: ['No valid data rows found.'] });
        setIsProcessing(false);
        return;
    }

    setValidationWarnings(localWarnings);
    const result = await updateOrAddItems(parsedItems, { fileName, mode: uploadMode });
    setLog({ ...result, errors: [...localErrors, ...result.errors] });
    setTextData('');
    setIsProcessing(false);
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
    setValidationWarnings([]);

    try {
        if (file.name.toLowerCase().endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const rows = (evt.target?.result as string).trim().split('\n').map(row => row.split(',').map(c => c.trim()));
                await processRowData(rows, file.name);
            };
            reader.readAsText(file);
        } else {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            await processRowData(jsonData, file.name);
        }
    } catch (error: any) {
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: [error.message] });
        setIsProcessing(false);
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Update Stock & Prices</h1>
        <p className="text-gray-500">Upload Company MRP lists or your own Stock Count sheets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Select Brand</h3>
            <div className="flex gap-3">
                <button onClick={() => setTargetBrand(Brand.HYUNDAI)} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${targetBrand === Brand.HYUNDAI ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Hyundai</button>
                <button onClick={() => setTargetBrand(Brand.MAHINDRA)} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${targetBrand === Brand.MAHINDRA ? 'bg-red-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Mahindra</button>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">2. Select File Content</h3>
            <div className="flex gap-3">
                <button onClick={() => setUploadMode('MASTER')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center ${uploadMode === 'MASTER' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><DollarSign size={14}/> Price List</button>
                <button onClick={() => setUploadMode('STOCK')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center ${uploadMode === 'STOCK' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}><Package size={14}/> Stock List</button>
            </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 flex">
            <button onClick={() => setActiveTab('file')} className={`flex-1 py-4 text-sm font-medium text-center ${activeTab === 'file' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>Upload File</button>
            <button onClick={() => setActiveTab('paste')} className={`flex-1 py-4 text-sm font-medium text-center ${activeTab === 'paste' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>Paste Data</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 text-sm font-medium text-center ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600'}`}>History & Undo</button>
        </div>

        <div className="p-8">
            {activeTab === 'history' ? (
              <div className="space-y-4">
                 {loadingHistory ? <div className="flex justify-center p-8"><TharLoader /></div> : historyList.length === 0 ? <p className="text-center text-gray-500 py-8">No upload history found.</p> : (
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                           <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {historyList.map(entry => (
                             <tr key={entry.id} className={entry.status === 'REVERTED' ? 'bg-red-50 opacity-75' : ''}>
                                <td className="px-4 py-3 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">{entry.fileName}</td>
                                <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded bg-gray-200">{entry.uploadMode}</span></td>
                                <td className="px-4 py-3">{entry.itemCount}</td>
                                <td className="px-4 py-3 text-right">
                                   {entry.status === 'REVERTED' ? <span className="text-xs font-bold text-red-600">REVERTED</span> : (
                                      <button onClick={() => handleRevert(entry)} disabled={revertingId === entry.id} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center justify-end gap-1 w-full disabled:opacity-50">
                                         {revertingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Undo
                                      </button>
                                   )}
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   </div>
                 )}
              </div>
            ) : activeTab === 'file' ? (
                <div className="border-2 border-dashed border-blue-200 rounded-xl p-12 text-center bg-blue-50/50 relative group">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><UploadIcon size={32} /></div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Upload {targetBrand} {uploadMode}</h3>
                    <p className="text-sm text-gray-500 mb-6">Supports .xlsx, .xls, and .csv</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">Select File<input type="file" accept=".csv, .xlsx, .xls, .xlsb" onChange={handleFileUpload} className="hidden"/></label>
                    {isProcessing && <div className="mt-4 text-blue-600 font-medium animate-pulse">Processing file data...</div>}
                </div>
            ) : (
                <div className="space-y-4">
                    <textarea value={textData} onChange={(e) => setTextData(e.target.value)} placeholder={uploadMode === 'MASTER' ? "HY-001, Air Filter, 8421, 450" : "HY-001, 50"} className="w-full h-64 p-4 border border-gray-200 rounded-lg font-mono text-sm outline-none" />
                    <button onClick={handlePasteProcess} disabled={!textData || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />} Process Data
                    </button>
                </div>
            )}
        </div>
      </div>

      {log && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg mb-6">
                {log.errors.length > 0 && log.added === 0 && log.updated === 0 ? <XCircle className="text-red-500" size={24} /> : <CheckCircle className="text-green-500" size={24} />} Upload Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center"><span className="block text-3xl font-bold text-green-700">{log.added}</span><span className="text-xs font-bold uppercase text-green-800">New Items</span></div>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center"><span className="block text-3xl font-bold text-gray-700">{log.updated}</span><span className="text-xs font-bold uppercase text-gray-600">Updated</span></div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center"><span className="block text-3xl font-bold text-blue-700">{log.priceUpdates}</span><span className="text-xs font-bold uppercase text-blue-800">Prices</span></div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-center"><span className="block text-3xl font-bold text-purple-700">{log.stockUpdates}</span><span className="text-xs font-bold uppercase text-purple-800">Stock</span></div>
            </div>
            {log.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-5 mb-4">
                    <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertCircle size={18} /> Errors ({log.errors.length})</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto pl-2">{log.errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default UploadPage;
