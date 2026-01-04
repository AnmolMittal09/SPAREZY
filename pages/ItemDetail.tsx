import React, { useEffect, useState } from 'react';
// @ts-ignore
import { useParams, Link } from 'react-router-dom';
import { fetchItemDetails, fetchPriceHistory } from '../services/inventoryService';
import { PriceHistoryEntry, StockItem, Brand } from '../types';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Tag, Box, Hash, Eye, EyeOff } from 'lucide-react';
import TharLoader from '../components/TharLoader';

const ItemDetail: React.FC = () => {
  const { partNumber } = useParams<{ partNumber: string }>();
  const [item, setItem] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);

  useEffect(() => { loadData(); }, [partNumber]);

  const loadData = async () => {
    if (!partNumber) return;
    setLoading(true);
    const [idat, hdat] = await Promise.all([fetchItemDetails(partNumber), fetchPriceHistory(partNumber)]);
    setItem(idat); setHistory(hdat); setLoading(false);
  };

  if (loading) return <TharLoader />;
  if (!item) return <div className="text-center py-12"><h2 className="text-xl font-bold text-slate-700">Not Found</h2><Link to="/" className="text-brand-600 mt-2 inline-block font-semibold">Dashboard</Link></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-4 px-1">
        <Link to="/" className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all active:scale-90"><ArrowLeft size={18} /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate uppercase">{item.partNumber}</h1>
          <p className="text-xs font-medium text-slate-500 truncate">{item.name}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase text-white ${item.brand === Brand.HYUNDAI ? 'bg-blue-800' : 'bg-red-700'}`}>{item.brand}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div onClick={() => setPriceVisible(!priceVisible)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-3d cursor-pointer hover:border-brand-300 transition-all flex flex-col justify-between h-28">
            <div className="flex justify-between items-center text-slate-500"><div className="flex items-center gap-1.5"><Tag size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">Current MRP</span></div>{priceVisible ? <EyeOff size={14} /> : <Eye size={14} className="text-brand-500" />}</div>
            <div className="flex items-baseline"><span className={`text-2xl font-bold text-slate-900 transition-all duration-300 ${priceVisible ? 'blur-0' : 'blur-md opacity-30'}`}>₹{item.price.toLocaleString()}</span>{!priceVisible && <span className="text-[10px] font-bold text-brand-600 animate-pulse ml-2">Click to show</span>}</div>
         </div>
         <div className={`p-4 rounded-xl border shadow-3d flex flex-col justify-between h-28 ${item.quantity === 0 ? 'bg-rose-50 border-rose-100 text-rose-800' : item.quantity < item.minStockThreshold ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-teal-50 border-teal-100 text-teal-800'}`}>
            <div className="flex items-center gap-1.5"><Box size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">Inventory</span></div>
            <div className="text-2xl font-bold">{item.quantity} <span className="text-xs font-medium opacity-70">Units</span></div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3d flex flex-col justify-center gap-2 h-28">
             <div className="flex justify-between text-[11px] font-medium"><span className="text-slate-500 uppercase tracking-wider">HSN Code</span><span className="font-bold">{item.hsnCode}</span></div>
             <div className="flex justify-between text-[11px] font-medium"><span className="text-slate-500 uppercase tracking-wider">Updated</span><span className="font-bold">{new Date(item.lastUpdated).toLocaleDateString()}</span></div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-3d border border-slate-200 overflow-hidden">
         <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center"><h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Price History</h2><span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{history.length} Entries</span></div>
         {history.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs font-medium">No recorded price changes</div> : (
            <div className="overflow-x-auto">
               <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2 text-right">Prev</th><th className="px-4 py-2 text-center">Change</th><th className="px-4 py-2 text-right">New MRP</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                     {history.map((e) => {
                        const d = e.newPrice - e.oldPrice;
                        return (<tr key={e.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-500">{new Date(e.changeDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right text-slate-400">₹{e.oldPrice}</td>
                              <td className="px-4 py-3 text-center"><span className={`px-1.5 py-0.5 rounded font-bold ${d > 0 ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>{d > 0 ? '+' : ''}₹{d}</span></td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">₹{e.newPrice}</td>
                           </tr>);
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );
};
export default ItemDetail;