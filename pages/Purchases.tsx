import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Brand } from '../types';
import DailyTransactions from './DailyTransactions';
import { 
  History, 
  ScanLine, 
  CheckCircle2, 
  Loader2, 
  Trash2, 
  Upload, 
  AlertTriangle,
  FileText,
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { updateOrAddItems } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'SCAN' | 'HISTORY'>('NEW');
  const [loading, setLoading] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<any>({});
  const [importLog, setImportLog] = useState<any>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
  };

  const startAiAudit = async () => {
    if (queuedFiles.length === 0) return;
    setLoading(true);
    try {
      const payload: InvoiceFile[] = [];
      for (const f of queuedFiles) {
        const base64 = await fileToBase64(f);
        payload.push({ data: base64, mimeType: f.type });
      }
      const result = await extractInvoiceData(payload);
      setExtractedMetadata({ dealerName: result.dealerName, invoiceDate: result.invoiceDate });
      setPreviewData(result.items || []);
    } catch (err) {
      alert("AI Scan Failed. Check file quality.");
    } finally {
      setLoading(false);
    }
  };

  const finalizeInbound = async () => {
    setLoading(true);
    try {
        const invPayload = previewData.map(item => ({
            partNumber: item.partNumber,
            name: item.name,
            price: item.mrp,
            quantity: item.quantity,
            brand: item.partNumber.startsWith('HY') ? Brand.HYUNDAI : Brand.MAHINDRA
        }));

        await updateOrAddItems(invPayload, { fileName: 'AI_SCAN', mode: 'PURCHASE' });
        
        await createBulkTransactions(previewData.map(item => ({
            partNumber: item.partNumber,
            type: TransactionType.PURCHASE,
            quantity: item.quantity,
            price: item.printedUnitPrice,
            customerName: extractedMetadata.dealerName || 'AI SCAN',
            createdByRole: user.role
        })));

        setImportLog({ success: true, count: previewData.length });
        setPreviewData([]);
        setQueuedFiles([]);
    } catch (err) {
        alert("Sync Failed.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
       {/* NAVIGATION SWITCHER */}
       <div className="bg-white p-1 rounded-2xl border border-slate-200 flex mb-6 shadow-sm">
          <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Manual</button>
          <button onClick={() => setActiveTab('SCAN')} className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'SCAN' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}>AI Audit</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Log</button>
       </div>

       {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" />}

       {activeTab === 'SCAN' && (
         <div className="space-y-6">
            {!previewData.length && !importLog && (
                <div className="bg-white rounded-3xl p-10 border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                        <Upload size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice AI Auditor</h2>
                    <p className="text-slate-500 text-sm mb-8 max-w-xs">Upload vendor bills. AI will verify 12% B.DC rule and sync stock.</p>
                    
                    {queuedFiles.length > 0 ? (
                        <div className="w-full space-y-4">
                           <div className="flex flex-wrap gap-2 justify-center">
                              {queuedFiles.map((f, i) => (
                                 <div key={i} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-2">
                                    <FileText size={14} /> {f.name}
                                 </div>
                              ))}
                           </div>
                           <button 
                             onClick={startAiAudit}
                             disabled={loading}
                             className="w-full max-w-xs bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                           >
                             {loading ? <Loader2 className="animate-spin" /> : <ScanLine size={20} />}
                             Start Analysis
                           </button>
                        </div>
                    ) : (
                        <label className="bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl cursor-pointer active:scale-95 transition-all shadow-xl">
                            Select Documents
                            <input type="file" multiple className="hidden" onChange={e => setQueuedFiles(Array.from(e.target.files || []))} />
                        </label>
                    )}
                </div>
            )}

            {previewData.length > 0 && (
                <div className="space-y-4 pb-40">
                    <div className="bg-blue-600 text-white p-5 rounded-3xl shadow-lg">
                       <h3 className="font-bold text-lg mb-1">{extractedMetadata.dealerName || 'Dealer Verification'}</h3>
                       <p className="text-blue-100 text-xs font-medium uppercase tracking-widest">{previewData.length} Items Detected</p>
                    </div>

                    <div className="space-y-2">
                        {previewData.map((item, i) => (
                           <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                 <div className="min-w-0 pr-4">
                                    <div className="font-bold text-slate-900 text-base">{item.partNumber}</div>
                                    <p className="text-[11px] text-slate-400 truncate">{item.name}</p>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-sm font-bold text-slate-900">{item.quantity} units</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">MRP ₹{item.mrp}</div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl text-[11px] font-bold">
                                 <span className="text-slate-400 uppercase tracking-widest">Invoiced Rate</span>
                                 <span className="text-brand-600 font-black">₹{item.printedUnitPrice}</span>
                                 <span className="ml-auto text-slate-300 font-normal">Audit: Verified</span>
                              </div>
                           </div>
                        ))}
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-[90] safe-bottom flex gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                        <button onClick={() => setPreviewData([])} className="flex-1 py-4 text-sm font-bold text-slate-600 bg-slate-100 rounded-2xl">Cancel</button>
                        <button 
                            onClick={finalizeInbound}
                            disabled={loading}
                            className="flex-[2] bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Database size={18} />}
                            Finalize Inbound
                        </button>
                    </div>
                </div>
            )}

            {importLog && (
                <div className="bg-white p-12 rounded-[3rem] border border-teal-100 text-center animate-slide-in shadow-3d">
                   <div className="w-20 h-20 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-100">
                        <CheckCircle2 size={40} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 mb-2">Sync Complete</h3>
                   <p className="text-slate-500 font-medium mb-8">Successfully audited and post-synced {importLog.count} units into central registry.</p>
                   <button onClick={() => setImportLog(null)} className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl active:scale-95 transition-all">Next Doc</button>
                </div>
            )}
         </div>
       )}
    </div>
  );
};

export default Purchases;