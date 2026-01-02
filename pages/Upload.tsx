import React, { useState, useEffect } from 'react';
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  FileText, 
  DollarSign, 
  Package, 
  History, 
  Undo2, 
  Loader2, 
  AlertTriangle, 
  XCircle, 
  ScanLine,
  ChevronRight,
  ShieldCheck,
  X,
  Zap,
  ArrowRight
} from 'lucide-react';
import { updateOrAddItems, UpdateResult, fetchUploadHistory, revertUploadBatch } from '../services/inventoryService';
import { extractInvoiceData } from '../services/geminiService';
import { Brand, StockItem, UploadHistoryEntry } from '../types';
import * as XLSX from 'xlsx';
import TharLoader from '../components/TharLoader';

type UploadMode = 'MASTER' | 'STOCK' | 'AI_SMART';

const UploadPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'ai' | 'history'>('ai');
  const [textData, setTextData] = useState('');
  const [log, setLog] = useState<UpdateResult | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetBrand, setTargetBrand] = useState<Brand>(Brand.HYUNDAI);
  const [uploadMode, setUploadMode] = useState<UploadMode>('AI_SMART');
  
  // AI Preview State
  const [aiPreviewItems, setAiPreviewItems] = useState<any[]>([]);
  
  // History State
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
    const data = await fetchUploadHistory();
    setHistoryList(data);
    setLoadingHistory(false);
  };

  const handleRevert = async (entry: UploadHistoryEntry) => {
    if (!window.confirm(`Are you sure you want to revert the upload "${entry.fileName}"? This will undo all changes to ${entry.itemCount} items.`)) {
      return;
    }

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

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setAiPreviewItems([]);
    setLog(null);
    setValidationWarnings([]);

    try {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        const result = await extractInvoiceData(base64, file.type);
        
        if (result && result.items && result.items.length > 0) {
          setAiPreviewItems(result.items);
        } else {
          throw new Error("AI could not find any spare parts in this document.");
        }
      } else {
        throw new Error("Please upload a PDF or an Image for AI Scanning.");
      }
    } catch (err: any) {
      alert(err.message || "AI Extraction failed.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const confirmAiUpdate = async () => {
    if (aiPreviewItems.length === 0) return;
    setIsProcessing(true);

    const payload: Partial<StockItem>[] = aiPreviewItems.map(item => ({
      partNumber: item.partNumber,
      name: uploadMode !== 'STOCK' ? item.name : undefined,
      brand: targetBrand,
      quantity: uploadMode !== 'MASTER' ? item.quantity : undefined,
      price: uploadMode !== 'STOCK' ? item.mrp : undefined
    }));

    const result = await updateOrAddItems(payload, { 
      fileName: `AI_SCAN_${new Date().getTime()}`, 
      mode: `AI_${uploadMode}_UPDATE` 
    });

    setLog(result);
    setAiPreviewItems([]);
    setIsProcessing(false);
  };

  const processRowData = async (rows: any[][], fileName: string = 'Manual Paste') => {
    const parsedItems: Partial<StockItem>[] = [];
    const localErrors: string[] = [];
    const localWarnings: string[] = [];
    const seenPartNumbers = new Set<string>();
    
    rows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        const firstCell = String(row[0] || '').toLowerCase().trim();
        if (['part no', 'part number', 'part_no', 'code', 'sl no', 's.no'].includes(firstCell)) return;

        let partNumber = String(row[0] || '').trim();
        if (!partNumber) {
            localErrors.push(`Row ${index + 1}: Skipped - Missing Part Number`);
            return; 
        }

        if (seenPartNumbers.has(partNumber.toLowerCase())) {
            localWarnings.push(`Row ${index + 1}: Duplicate Part Number "${partNumber}" found in this file. Using latest value.`);
        }
        seenPartNumbers.add(partNumber.toLowerCase());

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
                if (!isNaN(parsed)) {
                    price = parsed;
                }
            }
        } else {
            const col1 = row[1];
            const col2 = row[2];
            let quantityRaw = col1;
            const isCol2Number = col2 !== undefined && col2 !== null && String(col2).trim() !== '' && !isNaN(Number(col2));
            const isCol1Number = col1 !== undefined && col1 !== null && String(col1).trim() !== '' && !isNaN(Number(col1));

            if (isCol2Number && !isCol1Number) quantityRaw = col2;

            if (quantityRaw !== undefined && quantityRaw !== null && String(quantityRaw).trim() !== '') {
                const parsed = parseInt(String(quantityRaw).replace(/[^0-9]/g, ''));
                if (!isNaN(parsed)) {
                    quantity = parsed;
                }
            }
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
    try {
        if (file.name.toLowerCase().endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const rows = (evt.target?.result as string).trim().split('\n').map(row => row.split(',').map(c => c.trim()));
                await processRowData(rows, file.name);
            };
            reader.readAsText(file);
        } else if (file.name.match(/\.(xlsx|xls|xlsb|xlsm)$/i)) {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
            await processRowData(jsonData, file.name);
        }
    } catch (error: any) {
        setLog({ added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: [error.message] });
        setIsProcessing(false);
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bulk Updates</h1>
          <p className="text-slate-500 font-medium">Keep your inventory master data and stock counts in sync.</p>
        </div>
        <div className="hidden md:flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft">
           <button onClick={() => setTargetBrand(Brand.HYUNDAI)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${targetBrand === Brand.HYUNDAI ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Hyundai</button>
           <button onClick={() => setTargetBrand(Brand.MAHINDRA)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${targetBrand === Brand.MAHINDRA ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Mahindra</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
        <div className="border-b border-slate-50 flex overflow-x-auto no-scrollbar bg-slate-50/30">
            <button 
                onClick={() => { setActiveTab('ai'); setLog(null); setAiPreviewItems([]); setUploadMode('AI_SMART'); }}
                className={`flex-1 min-w-[150px] py-6 text-xs font-black uppercase tracking-[0.2em] text-center transition-all flex flex-col items-center justify-center gap-2 ${activeTab === 'ai' ? 'bg-white text-brand-600 border-b-4 border-brand-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <Zap size={22} className={activeTab === 'ai' ? 'animate-pulse' : ''} />
                AI Smart Scan
            </button>
            <button 
                onClick={() => { setActiveTab('file'); setLog(null); setUploadMode('MASTER'); }}
                className={`flex-1 min-w-[150px] py-6 text-xs font-black uppercase tracking-[0.2em] text-center transition-all flex flex-col items-center justify-center gap-2 ${activeTab === 'file' ? 'bg-white text-slate-900 border-b-4 border-slate-900 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <FileSpreadsheet size={22} />
                Excel Upload
            </button>
            <button 
                onClick={() => { setActiveTab('paste'); setLog(null); setUploadMode('MASTER'); }}
                className={`flex-1 min-w-[150px] py-6 text-xs font-black uppercase tracking-[0.2em] text-center transition-all flex flex-col items-center justify-center gap-2 ${activeTab === 'paste' ? 'bg-white text-slate-900 border-b-4 border-slate-900 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <FileText size={22} />
                Paste Raw
            </button>
            <button 
                onClick={() => { setActiveTab('history'); setLog(null); }}
                className={`flex-1 min-w-[150px] py-6 text-xs font-black uppercase tracking-[0.2em] text-center transition-all flex flex-col items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-slate-900 border-b-4 border-slate-900 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                <History size={22} />
                History
            </button>
        </div>

        <div className="flex-1 p-8 lg:p-12">
            {activeTab === 'ai' && (
              <div className="h-full flex flex-col space-y-10">
                {!aiPreviewItems.length && !log && (
                  <div className="max-w-2xl mx-auto w-full space-y-10 animate-fade-in">
                    <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-slate-100 rounded-[2rem] w-full max-w-lg mx-auto">
                        <button onClick={() => setUploadMode('MASTER')} className={`flex-1 px-4 py-3 rounded-3xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${uploadMode === 'MASTER' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          <DollarSign size={14} /> MRP Only
                        </button>
                        <button onClick={() => setUploadMode('STOCK')} className={`flex-1 px-4 py-3 rounded-3xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${uploadMode === 'STOCK' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Package size={14} /> Stock Only
                        </button>
                        <button onClick={() => setUploadMode('AI_SMART')} className={`flex-1 px-4 py-3 rounded-3xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${uploadMode === 'AI_SMART' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Zap size={14} /> Smart Update
                        </button>
                    </div>

                    <div className="bg-brand-50 border border-brand-100 rounded-[2rem] p-8 flex gap-6 items-start">
                        <div className="p-4 bg-brand-600 text-white rounded-2xl shadow-xl shadow-brand-100 flex-none"><Zap size={28} /></div>
                        <div>
                            <h3 className="font-black text-brand-900 text-lg uppercase tracking-tight">AI Multi-Update</h3>
                            <p className="text-[14px] text-brand-700/80 mt-2 leading-relaxed font-medium">
                                Upload any document (Image/PDF). {uploadMode === 'AI_SMART' ? 'Sparezy will extract both MRP and Quantities.' : uploadMode === 'MASTER' ? 'Sparezy will extract MRPs and update the master price list.' : 'Sparezy will extract quantities and update stock levels.'}
                            </p>
                        </div>
                    </div>

                    <div className="border-4 border-dashed border-slate-100 rounded-[3rem] p-16 text-center hover:border-brand-400 hover:bg-brand-50/20 transition-all group relative cursor-pointer">
                        {isProcessing ? (
                          <div className="py-8"><TharLoader /><p className="mt-8 font-black text-brand-600 animate-pulse text-sm uppercase tracking-widest">Digitizing Document...</p></div>
                        ) : (
                          <>
                            <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-brand-50 group-hover:text-brand-500 transition-all shadow-inner"><ScanLine size={44} /></div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Drop Price Sheet or Bill</h2>
                            <p className="text-slate-400 mb-10 max-w-xs mx-auto text-[14px] font-bold">PDF, JPEG, or Phone Gallery Capture</p>
                            <label className="inline-flex items-center gap-3 bg-brand-600 hover:bg-brand-700 text-white font-black px-12 py-5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-2xl shadow-brand-200 uppercase text-[13px] tracking-widest">
                               <UploadIcon size={24} /> Select Document
                               <input type="file" accept="application/pdf, image/*" className="hidden" onChange={handleAiScan} />
                            </label>
                          </>
                        )}
                    </div>
                  </div>
                )}

                {aiPreviewItems.length > 0 && (
                   <div className="h-full flex flex-col max-w-4xl mx-auto w-full animate-slide-up">
                      <div className="bg-slate-900 text-white p-8 rounded-t-[2.5rem] flex justify-between items-center">
                         <div className="flex items-center gap-5">
                            <div className="bg-brand-600 p-3 rounded-2xl shadow-lg"><Zap size={24} /></div>
                            <div>
                               <h3 className="font-black text-xl leading-none">AI Extraction Preview</h3>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Mode: {uploadMode === 'AI_SMART' ? 'Smart (All)' : uploadMode === 'MASTER' ? 'MRP Only' : 'Stock Only'}</p>
                            </div>
                         </div>
                         <button onClick={() => setAiPreviewItems([])} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><X size={20} /></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto bg-slate-50 border-x border-slate-100 p-6 space-y-4 no-scrollbar max-h-[500px]">
                         {aiPreviewItems.map((item, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-brand-200 transition-all">
                               <div className="flex-1 min-w-0">
                                  <div className="font-black text-slate-900 text-lg group-hover:text-brand-600 transition-colors">{item.partNumber}</div>
                                  <div className="text-xs text-slate-400 font-bold truncate mt-1">{item.name}</div>
                               </div>
                               <div className="flex items-center gap-10">
                                  {uploadMode !== 'STOCK' && (
                                    <div className="text-right">
                                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Scanned MRP</p>
                                       <p className="font-black text-slate-800">₹{item.mrp?.toLocaleString()}</p>
                                    </div>
                                  )}
                                  {uploadMode !== 'MASTER' && (
                                    <div className="text-right min-w-[60px]">
                                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Scanned Qty</p>
                                       <p className="font-black text-brand-600">+{item.quantity} units</p>
                                    </div>
                                  )}
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="bg-white border-t border-slate-100 p-8 rounded-b-[2.5rem] shadow-soft">
                         <button 
                           onClick={confirmAiUpdate}
                           className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-5.5 rounded-3xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 text-lg uppercase tracking-widest"
                         >
                            <ShieldCheck size={26} /> Sync {aiPreviewItems.length} items to Master
                         </button>
                      </div>
                   </div>
                )}
              </div>
            )}

            {(activeTab === 'file' || activeTab === 'paste') && (
              <div className="space-y-10 animate-fade-in max-w-4xl mx-auto w-full">
                <div className="flex gap-4 p-1.5 bg-slate-100 rounded-[2rem] w-fit mx-auto">
                    <button onClick={() => setUploadMode('MASTER')} className={`px-10 py-4 rounded-3xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-3 ${uploadMode === 'MASTER' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                      <DollarSign size={18} /> Price Master
                    </button>
                    <button onClick={() => setUploadMode('STOCK')} className={`px-10 py-4 rounded-3xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-3 ${uploadMode === 'STOCK' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Package size={18} /> Stock Inventory
                    </button>
                </div>

                {activeTab === 'file' ? (
                   <div className="border-4 border-dashed border-slate-100 rounded-[3rem] p-20 text-center bg-slate-50/30 hover:bg-white hover:border-brand-400 transition-all group cursor-pointer relative">
                      <div className="w-24 h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:bg-brand-50 group-hover:text-brand-500 transition-all shadow-inner"><FileSpreadsheet size={44} /></div>
                      <h3 className="text-2xl font-black text-slate-900 mb-2">Upload {targetBrand} Data</h3>
                      <p className="text-slate-400 mb-10 max-w-xs mx-auto text-[14px] font-bold">CSV or Excel format accepted</p>
                      <label className="inline-flex items-center gap-3 bg-slate-900 hover:bg-black text-white font-black px-12 py-5 rounded-[2rem] cursor-pointer transition-all active:scale-95 shadow-2xl uppercase text-[13px] tracking-widest">
                          <UploadIcon size={24} /> Select Spreadhseet
                          <input type="file" accept=".csv, .xlsx, .xls, .xlsb" className="hidden" onChange={handleFileUpload} />
                      </label>
                   </div>
                ) : (
                   <div className="space-y-6">
                      <div className="bg-slate-900 p-6 rounded-[2rem] text-[13px] text-slate-300 font-medium font-mono leading-relaxed border border-slate-800 shadow-inner">
                         <span className="text-brand-400 font-black block mb-2 uppercase tracking-widest text-[10px]">Expected Data Format:</span>
                         {uploadMode === 'MASTER' ? "PartNumber, Name, HSN, Price (New Line for next item)" : "PartNumber, Quantity (New Line for next item)"}
                      </div>
                      <textarea 
                        value={textData}
                        onChange={(e) => setTextData(e.target.value)}
                        placeholder="HY-AIR-01, Air Filter, 8421, 450..."
                        className="w-full h-80 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-mono text-[15px] font-bold text-slate-700 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all outline-none shadow-inner no-scrollbar"
                      />
                      <button 
                        onClick={handlePasteProcess}
                        disabled={!textData || isProcessing}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-6 rounded-3xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 text-lg uppercase tracking-widest shadow-xl shadow-brand-200"
                      >
                         {isProcessing ? <RefreshCw className="animate-spin" size={24} /> : <Zap size={24} />}
                         Process & Sync Data
                      </button>
                   </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="max-w-4xl mx-auto w-full animate-fade-in">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Audit History</h3>
                    <button onClick={loadHistory} className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all"><RefreshCw size={20}/></button>
                 </div>
                 
                 {loadingHistory ? (
                   <div className="py-20 flex justify-center"><TharLoader /></div>
                 ) : (
                   <div className="grid grid-cols-1 gap-4">
                      {historyList.map(entry => (
                         <div key={entry.id} className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-premium flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${entry.status === 'REVERTED' ? 'opacity-50 grayscale' : 'hover:border-slate-200'}`}>
                            <div className="flex items-center gap-5">
                               <div className={`p-4 rounded-2xl ${entry.status === 'REVERTED' ? 'bg-slate-100 text-slate-400' : 'bg-brand-50 text-brand-600'}`}>
                                  {entry.status === 'REVERTED' ? <Undo2 size={24}/> : <FileText size={24}/>}
                               </div>
                               <div>
                                  <div className="font-black text-slate-900 text-lg leading-none mb-2">{entry.fileName}</div>
                                  <div className="flex items-center gap-3 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                                     <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                                     <span className="text-slate-200">|</span>
                                     <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">{entry.uploadMode}</span>
                                  </div>
                               </div>
                            </div>
                            
                            <div className="flex items-center justify-between md:justify-end gap-10 border-t md:border-0 pt-4 md:pt-0">
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Items</p>
                                  <p className="font-black text-slate-900">{entry.itemCount}</p>
                               </div>
                               {entry.status !== 'REVERTED' && (
                                  <button 
                                    onClick={() => handleRevert(entry)}
                                    disabled={revertingId === entry.id}
                                    className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 border border-rose-100"
                                  >
                                     {revertingId === entry.id ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
                                     Rollback
                                  </button>
                               )}
                               {entry.status === 'REVERTED' && <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] bg-rose-50 px-3 py-1 rounded-lg">Reverted</span>}
                            </div>
                         </div>
                      ))}
                   </div>
                 )}
              </div>
            )}

            {log && (
               <div className="mt-12 animate-slide-up max-w-4xl mx-auto w-full">
                  <div className="p-10 bg-white rounded-[3rem] border-2 border-slate-100 shadow-2xl flex flex-col items-center text-center">
                      <div className={`w-24 h-24 rounded-full mb-8 flex items-center justify-center shadow-xl ${log.errors.length === 0 ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                         {log.errors.length === 0 ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">Update Synchronized</h3>
                      <p className="text-slate-400 font-bold mt-4 max-w-sm">The following changes have been permanently applied to the central inventory ledger.</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-12">
                          <div className="bg-slate-50 p-6 rounded-[2.5rem] shadow-inner border border-slate-100">
                             <span className="block text-3xl font-black text-slate-900">{log.added}</span>
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 block">New SKUs</span>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-[2.5rem] shadow-inner border border-slate-100">
                             <span className="block text-3xl font-black text-slate-900">{log.updated}</span>
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 block">Modified</span>
                          </div>
                          <div className="bg-blue-50 p-6 rounded-[2.5rem] shadow-inner border border-blue-100">
                             <span className="block text-3xl font-black text-blue-900">{log.priceUpdates}</span>
                             <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1 block">Prices</span>
                          </div>
                          <div className="bg-teal-50 p-6 rounded-[2.5rem] shadow-inner border border-teal-100">
                             <span className="block text-3xl font-black text-teal-900">{log.stockUpdates}</span>
                             <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest mt-1 block">Qty Adjust</span>
                          </div>
                      </div>

                      {log.errors.length > 0 && (
                        <div className="mt-8 w-full p-6 bg-rose-50 border border-rose-100 rounded-3xl text-left">
                           <h4 className="text-rose-700 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                             <XCircle size={16}/> Critical Parsing Failures
                           </h4>
                           <ul className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                              {log.errors.map((err, i) => <li key={i} className="text-[13px] text-rose-600 font-bold flex gap-2"><span className="opacity-40">•</span> {err}</li>)}
                           </ul>
                        </div>
                      )}

                      <button onClick={() => setLog(null)} className="mt-12 text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] hover:text-brand-600 transition-all">Start New Batch</button>
                  </div>
               </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;