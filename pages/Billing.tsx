
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role } from '../types';
import DailyTransactions from './DailyTransactions'; 
import { 
  History, 
  PlusCircle, 
  User as UserIcon, 
  Undo2, 
  Search, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Minus, 
  Plus, 
  Loader2,
  Filter,
  ArrowUpDown,
  X,
  Layers,
  List,
  ChevronRight,
  Package,
  ArrowLeft,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import ConfirmModal from '../components/ConfirmModal';

interface GroupedBill {
  id: string;
  createdAt: string;
  customerName: string;
  type: TransactionType;
  items: Transaction[];
  totalAmount: number;
}

const Billing: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'RETURN' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<'STACKED' | 'LIST'>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBill, setSelectedBill] = useState<GroupedBill | null>(null);

  const loadHistory = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchTransactions(TransactionStatus.APPROVED, [TransactionType.SALE, TransactionType.RETURN]);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') loadHistory();
  }, [activeTab]);

  const stackedHistory = useMemo(() => {
    const groups: Record<string, GroupedBill> = {};
    history.forEach(tx => {
      const key = `${tx.createdAt}_${tx.customerName}_${tx.type}`;
      if (!groups[key]) {
        groups[key] = { id: tx.id, createdAt: tx.createdAt, customerName: tx.customerName, type: tx.type, items: [], totalAmount: 0 };
      }
      groups[key].items.push(tx);
      groups[key].totalAmount += (tx.price * tx.quantity);
    });
    return Object.values(groups).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [history]);

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent overflow-hidden">
       {/* MOBILE NAV */}
       <div className="md:hidden bg-white p-3 border-b border-slate-100 flex items-center justify-between shadow-sm sticky top-0 z-[100]">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 mr-4">
             <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>New Sale</button>
             <button onClick={() => setActiveTab('RETURN')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'RETURN' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Return</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Log</button>
          </div>
          <button onClick={() => loadHistory(true)} className="p-2 text-slate-400"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
       </div>

       <div className="hidden md:flex justify-between items-center mb-8 px-1 pt-4">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Counter & Sales</h1>
             <p className="text-slate-500 font-medium">Retail billing and customer returns audit.</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Sale Entry</button>
             <button onClick={() => setActiveTab('RETURN')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'RETURN' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Return Stock</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Sale Log</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="SALES" />}
          {activeTab === 'RETURN' && <DailyTransactions user={user} forcedMode="RETURN" />}

          {activeTab === 'HISTORY' && (
             <div className="h-full flex flex-col p-4 space-y-4 max-w-5xl mx-auto overflow-y-auto no-scrollbar pb-32">
                {loading ? <TharLoader /> : stackedHistory.length === 0 ? <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest text-[10px]">No transaction history</div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {stackedHistory.map(bill => (
                        <div key={bill.id} onClick={() => setSelectedBill(bill)} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-slate-300 transition-all group animate-fade-in relative cursor-pointer">
                           <div className="flex justify-between items-start mb-4">
                              <div className="space-y-1">
                                 <div className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg inline-block ${bill.type === 'SALE' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>{bill.type}</div>
                                 <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mt-1"><Calendar size={12}/> {new Date(bill.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="bg-slate-900 text-white p-2 rounded-xl shadow-lg active:scale-90 transition-all opacity-0 group-hover:opacity-100"><ChevronRight size={18}/></div>
                           </div>
                           <h4 className="font-black text-slate-900 text-lg truncate group-hover:text-brand-600 transition-colors leading-tight mb-4">{bill.customerName || 'Standard Sale'}</h4>
                           <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-2">
                              <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-2"><Package size={12} className="text-slate-400"/><span className="text-[10px] font-black text-slate-500 uppercase">{bill.items.length} Items</span></div>
                              <p className={`text-xl font-black tabular-nums ${bill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>₹{bill.totalAmount.toLocaleString()}</p>
                           </div>
                        </div>
                     ))}
                  </div>
                )}
             </div>
          )}
       </div>

       {selectedBill && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up border border-slate-100">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                   <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedBill(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><ArrowLeft size={24}/></button>
                      <div>
                         <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{selectedBill.customerName || 'Billed Items'}</h4>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(selectedBill.createdAt).toLocaleDateString()} @ {new Date(selectedBill.createdAt).toLocaleTimeString()}</p>
                      </div>
                   </div>
                   <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${selectedBill.type === 'SALE' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>{selectedBill.type}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
                   {selectedBill.items.map((item, i) => (
                      <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                         <div className="flex-1 min-w-0 pr-4">
                            <p className="font-black text-slate-900 truncate">{item.partNumber}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">₹{item.price.toLocaleString()} x {item.quantity}</p>
                         </div>
                         <div className="text-right">
                            <p className="font-black text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                         </div>
                      </div>
                   ))}
                </div>
                <div className="p-8 border-t border-slate-100 bg-white flex flex-col gap-4">
                   <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Bill Total</p>
                      <p className={`text-4xl font-black tracking-tighter ${selectedBill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>₹{selectedBill.totalAmount.toLocaleString()}</p>
                   </div>
                   <button onClick={() => setSelectedBill(null)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl mt-4 active:scale-95 transition-all">Close Bill Detail</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default Billing;
