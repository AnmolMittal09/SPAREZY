import React, { useEffect, useState, useMemo } from 'react';
import { User, Transaction, TransactionType } from '../types';
import { fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  RotateCcw, 
  History,
  X,
  ChevronRight,
  Package,
  Clock,
  ArrowUpDown,
  Download,
  User as UserIcon,
  Users,
  Truck,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

type GroupTab = 'ALL' | 'CUSTOMERS' | 'SUPPLIERS';

interface EntityGroup {
  name: string;
  totalVolume: number;
  count: number;
  lastActive: string;
  transactions: Transaction[];
}

const StockMovements: React.FC<Props> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeGroupTab, setActiveGroupTab] = useState<GroupTab>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<EntityGroup | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (e) {
      console.error("Failed to load transactions", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      const txDate = new Date(tx.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (txDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
        if (txDate > end) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          tx.partNumber.toLowerCase().includes(query) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(query)) ||
          (tx.createdByName && tx.createdByName.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [transactions, typeFilter, startDate, endDate, searchQuery]);

  const customerGroups = useMemo(() => {
    const groups: Record<string, EntityGroup> = {};
    // Only Sales and Returns for customer tab
    filteredTransactions.filter(t => t.type === TransactionType.SALE || t.type === TransactionType.RETURN).forEach(tx => {
      const name = (tx.customerName || 'Retail Walk-in').toUpperCase().trim();
      if (!groups[name]) groups[name] = { name, totalVolume: 0, count: 0, lastActive: tx.createdAt, transactions: [] };
      const val = tx.price * tx.quantity;
      groups[name].totalVolume += tx.type === TransactionType.SALE ? val : -val;
      groups[name].count++;
      groups[name].transactions.push(tx);
      if (new Date(tx.createdAt) > new Date(groups[name].lastActive)) groups[name].lastActive = tx.createdAt;
    });
    return Object.values(groups).sort((a, b) => Math.abs(b.totalVolume) - Math.abs(a.totalVolume));
  }, [filteredTransactions]);

  const supplierGroups = useMemo(() => {
    const groups: Record<string, EntityGroup> = {};
    // Only Purchases for supplier tab
    filteredTransactions.filter(t => t.type === TransactionType.PURCHASE).forEach(tx => {
      const name = (tx.customerName || 'Main Supplier').toUpperCase().trim();
      if (!groups[name]) groups[name] = { name, totalVolume: 0, count: 0, lastActive: tx.createdAt, transactions: [] };
      groups[name].totalVolume += (tx.price * tx.quantity);
      groups[name].count++;
      groups[name].transactions.push(tx);
      if (new Date(tx.createdAt) > new Date(groups[name].lastActive)) groups[name].lastActive = tx.createdAt;
    });
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [filteredTransactions]);

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
      'Date': new Date(tx.createdAt).toLocaleDateString(),
      'Time': new Date(tx.createdAt).toLocaleTimeString(),
      'Process': tx.type,
      'Part Number': tx.partNumber,
      'Entity': tx.customerName || 'Direct Entry',
      'Logged By': tx.createdByName,
      'Quantity': tx.quantity,
      'Unit Rate': tx.price,
      'Total Value': tx.price * tx.quantity
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `Sparezy_Audit_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in max-w-6xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-elevated">
              <History size={28} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Audit Ledger</h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Transaction Registry Matrix</p>
           </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-1">
            <button onClick={handleExport} className="p-3.5 rounded-2xl border bg-white text-slate-500 border-slate-200 hover:text-teal-600 transition-all shadow-soft"><Download size={20} /></button>
            <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200 shadow-inner-soft">
                {[
                  { id: 'ALL', label: 'All Logs', icon: Layers },
                  { id: 'CUSTOMERS', label: 'Customers', icon: Users },
                  { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setActiveGroupTab(t.id as GroupTab)}
                    className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeGroupTab === t.id ? 'bg-white text-slate-900 shadow-soft border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <t.icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-3.5 rounded-2xl border transition-all ${showFilters ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 shadow-soft'}`}><Filter size={20} /></button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-[2rem] p-8 shadow-premium border border-slate-100 animate-slide-up">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Process Type</label>
                 <div className="grid grid-cols-2 gap-2">
                    {['ALL', TransactionType.SALE, TransactionType.PURCHASE, TransactionType.RETURN].map(t => (
                      <button key={t} onClick={() => setTypeFilter(t as any)} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === t ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{t}</button>
                    ))}
                 </div>
              </div>
              <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Start Date</label><input type="date" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20" value={startDate} onChange={e => setStartDate(e.target.value)}/></div>
              <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">End Date</label><input type="date" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20" value={endDate} onChange={e => setEndDate(e.target.value)}/></div>
           </div>
           <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end gap-3"><button onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); setStartDate(''); setEndDate(''); }} className="px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Reset</button><button onClick={() => setShowFilters(false)} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Apply Filters</button></div>
        </div>
      )}

      {activeGroupTab === 'ALL' ? (
        <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-soft border border-slate-100 text-blue-600"><ArrowRightLeft size={22} strokeWidth={2.5} /></div>
                    <div><h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1.5">Master Sequence</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chronological Stream</p></div>
                </div>
                <div className="relative group hidden md:block"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder="Quick Search..." className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-64 shadow-inner-soft outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></div>
            </div>
            <div className="flex-1 overflow-x-auto no-scrollbar">
                {filteredTransactions.length === 0 ? (
                  <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center"><div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft"><History className="opacity-10" size={64} /></div><p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Journal Empty</p></div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                      <tr><th className="px-10 py-6">Timestamp</th><th className="px-10 py-6">Identity / Part</th><th className="px-10 py-6 text-center">Type</th><th className="px-10 py-6 text-center">Qty</th><th className="px-10 py-6 text-right">Value</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-all group">
                          <td className="px-10 py-6">
                            <div className="flex flex-col"><span className="font-black text-slate-900 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(tx.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                          </td>
                          <td className="px-10 py-6">
                             <div className="flex flex-col gap-1">
                                <span className="font-black text-slate-900 text-[15px] tracking-tight uppercase group-hover:text-blue-600 transition-colors">{tx.partNumber}</span>
                                <div className="flex items-center gap-2"><UserIcon size={12} className="text-slate-300" /><span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[200px]">{tx.customerName || 'Retail Client'}</span></div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-center"><span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm inline-block ${tx.type === 'SALE' ? 'bg-teal-50 text-teal-600 border-teal-100' : tx.type === 'PURCHASE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{tx.type}</span></td>
                          <td className="px-10 py-6 text-center"><span className="text-lg font-black tracking-tight">{tx.type === 'SALE' ? '-' : '+'}{fd(tx.quantity)}</span> <span className="text-[9px] font-black text-slate-300 uppercase">PCS</span></td>
                          <td className="px-10 py-6 text-right"><div className="flex flex-col items-end"><span className="font-black text-slate-900 text-base tabular-nums">₹{(tx.price * tx.quantity).toLocaleString()}</span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">@ ₹{tx.price.toLocaleString()}</span></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
           {(activeGroupTab === 'CUSTOMERS' ? customerGroups : supplierGroups).map(group => (
              <div 
                key={group.name} 
                onClick={() => setSelectedEntity(group)}
                className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-soft hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
              >
                  <div className="flex justify-between items-start mb-8 relative z-10">
                      <div className={`w-14 h-14 ${activeGroupTab === 'CUSTOMERS' ? 'bg-blue-600' : 'bg-slate-900'} rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:rotate-6 transition-transform`}>
                          {activeGroupTab === 'CUSTOMERS' ? <UserIcon size={26} strokeWidth={2.5} /> : <Truck size={26} strokeWidth={2.5} />}
                      </div>
                      <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70">Lifetime Net</p>
                          <p className={`text-2xl font-black tracking-tighter tabular-nums leading-none ${group.totalVolume >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                             ₹{Math.abs(group.totalVolume).toLocaleString()}
                          </p>
                      </div>
                  </div>
                  <div className="mb-8 relative z-10">
                      <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight leading-tight truncate pr-6 group-hover:text-blue-600 transition-colors">{group.name}</h3>
                      <div className="flex items-center gap-3 mt-3">
                          <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-xl shadow-inner border border-slate-200 uppercase tracking-widest">{fd(group.count)} Logs</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">• Last: {new Date(group.lastActive).toLocaleDateString()}</span>
                      </div>
                  </div>
                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between relative z-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Full Identity Report</span>
                      <ChevronRight size={18} className="text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                  </div>
              </div>
           ))}
        </div>
      )}

      {selectedEntity && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-10 animate-fade-in no-scrollbar">
           <div className="bg-white w-full max-w-4xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-slide-up no-scrollbar">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-6">
                    <button onClick={() => setSelectedEntity(null)} className="p-3.5 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><X size={24} strokeWidth={3}/></button>
                    <div>
                       <h3 className="font-black text-slate-900 text-2xl tracking-tighter uppercase leading-none mb-1.5">{selectedEntity.name}</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Station Aggregate Ledger • {fd(selectedEntity.count)} Logs</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entity Flow</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">₹{selectedEntity.totalVolume.toLocaleString()}</p>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-10 no-scrollbar space-y-4">
                 {selectedEntity.transactions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(tx => (
                   <div key={tx.id} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-soft hover:shadow-premium transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                      <div className="flex items-center gap-6">
                         <div className={`p-3 rounded-2xl shadow-inner ${tx.type === 'SALE' ? 'bg-teal-50 text-teal-600' : tx.type === 'PURCHASE' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                            {tx.type === 'SALE' ? <TrendingUp size={20}/> : tx.type === 'PURCHASE' ? <ShoppingBag size={20}/> : <RotateCcw size={20}/>}
                         </div>
                         <div>
                            <p className="font-black text-slate-900 text-lg uppercase tracking-tight mb-1 group-hover:text-blue-600 transition-colors">{tx.partNumber}</p>
                            <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest"><Calendar size={12}/> {new Date(tx.createdAt).toLocaleDateString()} <span className="opacity-30">•</span> <Clock size={12}/> {new Date(tx.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-10 text-right self-end md:self-center">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">PROTOCOL</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border w-fit ml-auto ${tx.type === 'SALE' ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{tx.type}</span>
                         </div>
                         <div className="min-w-[80px]">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">NET VALUE</p>
                            <p className="font-black text-xl text-slate-900 tabular-nums tracking-tighter">₹{(tx.price * tx.quantity).toLocaleString()}</p>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StockMovements;