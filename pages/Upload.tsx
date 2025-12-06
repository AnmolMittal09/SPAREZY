
import React, { useState } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, FileText, DollarSign, Package } from 'lucide-react';
import { updateOrAddItems, UpdateResult } from '../services/inventoryService';
import { Brand, StockItem } from '../types';
import * as XLSX from 'xlsx';

type UploadMode = 'MASTER' | 'STOCK';

const UploadPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('file');
  const [textData, setTextData] = useState('');
  const [log, setLog] = useState<UpdateResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetBrand, setTargetBrand] = useState<Brand>(Brand.HYUNDAI);
  const [uploadMode, setUploadMode] = useState<UploadMode>('MASTER');

  const processRowData = async (rows: any[][]) => {
    const parsedItems: Partial<StockItem>[] = [];
    
    rows.forEach((row, index) => {
        // Skip empty rows
        if (!row || row.length === 0) return;
        
        // Skip header row loosely
        const firstCell = String(row[0] || '').toLowerCase().trim();
        if (['part no', 'part number', 'part_no', 'code'].includes(firstCell)) return;

        let partNumber = '';
        let name = '';
        let hsnCode = '';
        let price: number | undefined = undefined;
        let quantity: number | undefined = undefined;

        partNumber = String(row[0] || '').trim();
        if (!partNumber) return; // Skip if no part number

        if (uploadMode === 'MASTER') {
            // --- MASTER LIST MODE (Updates Price, Name, Details) ---
            if (targetBrand === Brand.HYUNDAI) {
                // Hyundai Specific Format:
                // Col 0: PART NO | Col 1: PART NAME | Col 2: HSN CD | Col 3: MRP (Price)
                name = String(row[1] || '').trim();
                hsnCode = String(row[2] || '').trim(); // HSN CD
                const priceStr = String(row[3] || '0').replace(/[^0-9.]/g, '');
                if (row[3] !== undefined) price = parseFloat(priceStr);
            } else {
                // Mahindra / General Master Format
                // Col 0: PartNo | Col 1: Name | Col 2: HSN CD | Col 3: Price
                name = String(row[1] || '').trim();
                hsnCode = String(row[2] || '').trim();
                const priceStr = String(row[3] || '0').replace(/[^0-9.]/g, '');
                if (row[3] !== undefined) price = parseFloat(priceStr);
            }
        } else {
            // --- STOCK LIST MODE (Updates Quantity Only) ---
            // Format: Col 0: Part No | Col 1: Quantity
            const qtyStr = String(row[1] || '0').replace(/[^0-9]/g, '');
            if (row[1] !== undefined) quantity = parseInt(qtyStr);
        }

        parsedItems.push({
            partNumber,
            name: name || undefined,
            brand: targetBrand,
            hsnCode: hsnCode || undefined,
            quantity: quantity,
            price: price
        });
    });

    if (parsedItems.length > 0) {
        // Await the async update
        const result = await updateOrAddItems(parsedItems);
        setLog(result);
        setTextData('');
    } else {
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: ['No valid data found in input.'] });
    }
    setIsProcessing(false);
  };

  const handlePasteProcess = async () => {
    setIsProcessing(true);
    // Basic CSV/TSV parser for pasted text
    const rows = textData.trim().split('\n').map(row => 
        row.split(/[\t,]+/).map(c => c.trim())
    );
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
                const rows = text.trim().split('\n').map(row => 
                    row.split(',').map(c => c.trim())
                );
                await processRowData(rows);
            };
            reader.readAsText(file);
        } else if (file.name.match(/\.(xlsx|xls|xlsb|xlsm)$/i)) {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            await processRowData(jsonData);
        } else {
            setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: ['Unsupported file format. Please use CSV or Excel (.xlsx, .xls, .xlsb)'] });
            setIsProcessing(false);
        }
    } catch (error) {
        console.error(error);
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: ['Failed to parse file. Ensure it is a valid CSV or Excel file.'] });
        setIsProcessing(false);
    }
    
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Update Stock & Prices</h1>
        <p className="text-gray-500">Upload Company MRP lists or your own Stock Count sheets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand Selection */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Select Brand</h3>
            <div className="flex gap-3">
                <button
                    onClick={() => setTargetBrand(Brand.HYUNDAI)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                        targetBrand === Brand.HYUNDAI 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Hyundai
                </button>
                <button
                    onClick={() => setTargetBrand(Brand.MAHINDRA)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                        targetBrand === Brand.MAHINDRA 
                        ? 'bg-red-600 text-white shadow-md' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Mahindra
                </button>
            </div>
          </div>

          {/* Upload Mode Selection */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">2. Select File Content</h3>
            <div className="flex gap-3">
                <button
                    onClick={() => setUploadMode('MASTER')}
                    className={`flex-1 py-3 px-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center gap-1 ${
                        uploadMode === 'MASTER' 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <span className="flex items-center gap-1"><DollarSign size={14}/> Price / Master List</span>
                    <span className="text-[10px] opacity-70 font-normal">Updates Price & Name</span>
                </button>
                <button
                    onClick={() => setUploadMode('STOCK')}
                    className={`flex-1 py-3 px-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center gap-1 ${
                        uploadMode === 'STOCK' 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <span className="flex items-center gap-1"><Package size={14}/> Stock Count List</span>
                    <span className="text-[10px] opacity-70 font-normal">Updates Quantity Only</span>
                </button>
            </div>
          </div>
      </div>

      {/* Main Upload Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 flex">
            <button 
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'file' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <FileSpreadsheet size={18} />
                Upload Excel / CSV
            </button>
            <button 
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'paste' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <FileText size={18} />
                Paste Raw Data
            </button>
        </div>

        <div className="p-8">
            {activeTab === 'file' ? (
                <div className="border-2 border-dashed border-blue-200 rounded-xl p-12 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors relative group">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <UploadIcon size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                        Upload {targetBrand} {uploadMode === 'MASTER' ? 'Price List' : 'Stock List'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        Supports .xlsx, .xls, .xlsb, and .csv
                    </p>
                    
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">
                        Select File
                        <input 
                            type="file" 
                            accept=".csv, .xlsx, .xls, .xlsb" 
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </label>
                    
                    {isProcessing && <div className="mt-4 text-blue-600 font-medium animate-pulse">Processing file data...</div>}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 border border-gray-200">
                        <p className="font-semibold mb-1 text-gray-900">
                            Required Format for {uploadMode === 'MASTER' ? 'Price List' : 'Stock List'}:
                        </p>
                        {uploadMode === 'MASTER' ? (
                            targetBrand === Brand.HYUNDAI ? (
                                <code className="block bg-white p-2 rounded border border-gray-200 text-xs text-blue-800">
                                    Col 1: PART NO | Col 2: PART NAME | Col 3: HSN CD | Col 4: MRP
                                </code>
                            ) : (
                                <code className="block bg-white p-2 rounded border border-gray-200 text-xs text-red-800">
                                    Col 1: Part No | Col 2: Name | Col 3: HSN Code | Col 4: Price
                                </code>
                            )
                        ) : (
                            <code className="block bg-white p-2 rounded border border-gray-200 text-xs text-gray-800">
                                Col 1: PART NO | Col 2: QUANTITY
                            </code>
                        )}
                    </div>
                    <textarea 
                        value={textData}
                        onChange={(e) => setTextData(e.target.value)}
                        placeholder={uploadMode === 'MASTER' ? "HY-001, Air Filter, 8421, 450" : "HY-001, 50"}
                        className="w-full h-64 p-4 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button 
                        onClick={handlePasteProcess}
                        disabled={!textData || isProcessing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        {isProcessing ? 'Processing...' : 'Process Data'}
                    </button>
                </div>
            )}
        </div>
      </div>

      {log && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                    {log.errors.length > 0 && log.added === 0 && log.updated === 0 ? (
                        <AlertCircle className="text-red-500" size={24} />
                    ) : (
                        <CheckCircle className="text-green-500" size={24} />
                    )}
                    Upload Summary
                </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                    <span className="block text-3xl font-bold text-green-700">{log.added}</span>
                    <span className="text-xs font-bold uppercase text-green-800 tracking-wide mt-1">New Items</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center">
                    <span className="block text-3xl font-bold text-gray-700">{log.updated}</span>
                    <span className="text-xs font-bold uppercase text-gray-600 tracking-wide mt-1">Items Touched</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
                    <span className="block text-3xl font-bold text-blue-700">{log.priceUpdates}</span>
                    <span className="text-xs font-bold uppercase text-blue-800 tracking-wide mt-1">Price Updates</span>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-center">
                    <span className="block text-3xl font-bold text-purple-700">{log.stockUpdates}</span>
                    <span className="text-xs font-bold uppercase text-purple-800 tracking-wide mt-1">Stock Updates</span>
                </div>
            </div>
            
            {log.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                    <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Issues Encountered ({log.errors.length})
                    </h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto pl-2">
                        {log.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default UploadPage;
