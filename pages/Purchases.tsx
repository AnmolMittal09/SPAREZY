import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionType, Brand } from '../types';
import DailyTransactions from './DailyTransactions';
import { 
  History, PlusCircle, ScanLine, CheckCircle2, 
  Loader2, Trash2, Upload, AlertCircle, FileText, 
  Database, ArrowRight, ArrowLeft, X
} from 'lucide-react';
import { fetchTransactions, createBulkTransactions } from '../services/transactionService';
import { updateOrAddItems, fetchInventory } from '../services/inventoryService';
import { extractInvoiceData, InvoiceFile } from '../services/geminiService';
import { triggerAutoRefresh } from '../services/refreshService';
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
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

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
      setExtractedMetadata(result);
      setPreviewData(result.items || []);
    } catch (err) { alert("AI Scan Failed."); } finally { setLoading(false); }
  };

  const finalizeInbound = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    try {
        const invPayload = previewData.map(item => {
            const existing = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());
            return {
                partNumber: item.partNumber,
                name: item.name,
                price: item.mrp,
                quantity: (existing?.quantity || 0) + item.quantity,
                brand: item.partNumber.startsWith('HY') ? Brand.HYUNDAI : Brand.MAHINDRA
            };
        });

        await updateOrAddItems(invPayload, { fileName: 'AI_SCAN', mode: 'PURCHASE' });
        
        await createBulkTransactions(previewData.map(item => ({
            partNumber: item.partNumber, type: TransactionType.PURCHASE,
            quantity: item.quantity, price: item.printedUnitPrice,
            customerName: extractedMetadata.dealerName || 'AI SCAN',
            createdByRole: user.role
        })));

        setLoading(true); // Keep spinner active during sync
        triggerAutoRefresh(1000);
    } catch (err) { 
        setLoading(false);
        alert("Sync Failed."); 
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
       <div className="flex bg-white p-1 rounded-lg border border-slate-200 w-fit self-start">
          <button onClick={() => setActiveTab('NEW')} className={`px-6 py-1.5 rounded text-xs font-black uppercase transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Manual</button>
          <button onClick={() => setActiveTab('SCAN')} className={`px-6 py-1.5 rounded text-xs font-black uppercase transition-all ${activeTab === 'SCAN' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500'}`}>AI Audit</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-1.5 rounded text-xs font-black uppercase transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Journal</button>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="PURCHASE" />}

          {activeTab === 'SCAN' && (
             <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                {!previewData.length ? (
                    <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                           <Upload size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-1">Invoice AI Processor</h2>
                        <p className="text-slate-500 text-sm mb-8">Upload vendor documents for automated 12% B.DC auditing.</p>
                        
                        {queuedFiles.length > 0 ? (
                            <div className="w-full space-y-4">
                               <div className="flex flex-wrap gap-2 justify-center">
                                  {queuedFiles.map((f, i) => (
                                     <div key={i} className="px-3 py-1 bg-slate-100 rounded text-[10px] font-black flex items-center gap-2 border border-slate-200 uppercase"> <FileText size={12} /> {f.name} </div>
                                  ))}
                               </div>
                               <button 
                                 onClick={startAiAudit} disabled={loading}
                                 className="w-full max-w-xs bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
                               >
                                 {loading ? <Loader2 className="animate-spin" /> : <ScanLine size={18} />}
                                 Begin Analysis
                               </button>
                            </div>
                        ) : (
                            <label className="bg-brand-600 text-white font-black px-10 py-4 rounded-xl cursor-pointer hover:bg-brand-700 transition-colors shadow-lg">
                                Select File(s)
                                <input type="file" multiple className="hidden" onChange={e => setQueuedFiles(Array.from(e.target.files || []))} />
                            </label>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-panel overflow-hidden">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-white/10 rounded"><Database size={18} /></div>
                               <span className="font-black uppercase text-xs tracking-widest">{extractedMetadata.dealerName || 'VENDOR AUDIT'}</span>
                            </div>
                            <button onClick={() => setPreviewData([])} className="text-white/50 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {previewData.map((item, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                                   <div className="flex-1 min-w-0 pr-4">
                                      <p className="font-bold text-slate-900 uppercase leading-none mb-1">{item.partNumber}</p>
                                      <p className="text-[10px] text-slate-400 font-bold truncate">{item.name}</p>
                                   </div>
                                   <div className="flex items-center gap-8">
                                       <div className="text-right">
                                          <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Rate</p>
                                          <p className="font-black text-slate-900">₹{item.printedUnitPrice}</p>
                                       </div>
                                       <div className="text-center w-12">
                                          <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Qty</p>
                                          <p className="font-black text-slate-900">{item.quantity}</p>
                                       </div>
                                       <div className={`p-2 rounded border ${item.discountPercent < 12 ? 'bg-rose-50 border-rose-100' : 'bg-teal-50 border-teal-100'}`}>
                                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Disc%</p>
                                          <p className={`font-black text-xs ${item.discountPercent < 12 ? 'text-rose-600' : 'text-teal-600'}`}>{item.discountPercent}%</p>
                                       </div>
                                   </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                            <p className="text-xs font-bold text-slate-500">Confirm audit results to update registry.</p>
                            <button onClick={finalizeInbound} disabled={loading} className="bg-brand-600 text-white font-black px-8 py-3 rounded-lg shadow-lg flex items-center gap-2 hover:bg-brand-700 disabled:opacity-50">
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                Finalize Inbound
                            </button>
                        </div>
                    </div>
                )}
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;
