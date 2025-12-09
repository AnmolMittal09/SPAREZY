

import React, { useEffect, useState } from 'react';
// @ts-ignore
import { useParams, Link } from 'react-router-dom';
import { fetchItemDetails, fetchPriceHistory, updateItemBarcode } from '../services/inventoryService';
import { PriceHistoryEntry, StockItem, Brand } from '../types';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Clock, Tag, Box, Hash, ScanBarcode, X } from 'lucide-react';
import TharLoader from '../components/TharLoader';

const ItemDetail: React.FC = () => {
  const { partNumber } = useParams<{ partNumber: string }>();
  const [item, setItem] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    loadData();
  }, [partNumber]);

  const loadData = async () => {
    if (!partNumber) return;
    setLoading(true);
    const [itemData, historyData] = await Promise.all([
      fetchItemDetails(partNumber),
      fetchPriceHistory(partNumber)
    ]);
    setItem(itemData);
    setHistory(historyData);
    setLoading(false);
  };

  // --- SCANNER LOGIC ---
  useEffect(() => {
    let html5QrCode: any;
    let isActive = true;

    const startScanner = async () => {
        if (showScanner && typeof window !== 'undefined') {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!isActive) return;

                html5QrCode = new Html5Qrcode("item-reader");
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                const onScanSuccess = async (decodedText: string) => {
                    await html5QrCode.stop();
                    setShowScanner(false);
                    if (item && partNumber) {
                        const result = await updateItemBarcode(partNumber, decodedText);
                        if (result.success) {
                            alert(`Barcode ${decodedText} linked to ${partNumber}`);
                            loadData(); // Refresh to show new barcode
                        } else {
                            alert("Failed to link: " + result.message);
                        }
                    }
                };

                await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, (err:any) => {});
            } catch (err) {
                console.error("Scanner Error", err);
                setShowScanner(false);
            }
        }
    };

    startScanner();

    return () => {
        isActive = false;
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(console.error);
        }
    };
  }, [showScanner]);

  if (loading) {
    return <TharLoader />;
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-700">Item Not Found</h2>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const isLowStock = item.quantity < item.minStockThreshold && item.quantity > 0;
  const isZeroStock = item.quantity === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black text-white">
                <h3 className="font-bold flex items-center gap-2">Scan to Link</h3>
                <button onClick={() => setShowScanner(false)} className="p-2 bg-white/20 rounded-full">
                    <X size={24} />
                </button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                 <div id="item-reader" className="w-full max-w-sm h-auto"></div>
            </div>
            <div className="p-6 bg-black text-white text-center">
                Scan product barcode to link it with <b>{item.partNumber}</b>
            </div>
        </div>
      )}

      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.partNumber}</h1>
          <p className="text-gray-500">{item.name}</p>
        </div>
        <div className="ml-auto flex gap-2">
             {/* Mobile Only Scan Button */}
             <button 
                onClick={() => setShowScanner(true)}
                className="md:hidden flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm active:scale-95"
             >
                <ScanBarcode size={16} /> Link Barcode
             </button>

             <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center ${
                item.brand === Brand.HYUNDAI ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
             }`}>
                {item.brand}
             </span>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Price Card */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
               <Tag size={18} />
               <span className="text-sm font-medium uppercase tracking-wide">Current Price</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">₹{item.price.toLocaleString()}</div>
         </div>

         {/* Stock Card */}
         <div className={`p-6 rounded-xl border shadow-sm flex flex-col justify-between ${
            isZeroStock ? 'bg-red-50 border-red-200' : isLowStock ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
         }`}>
            <div className={`flex items-center gap-2 mb-2 ${
                isZeroStock ? 'text-red-700' : isLowStock ? 'text-yellow-700' : 'text-green-700'
            }`}>
               <Box size={18} />
               <span className="text-sm font-bold uppercase tracking-wide">Current Stock</span>
            </div>
            <div className={`text-3xl font-bold ${
                isZeroStock ? 'text-red-900' : isLowStock ? 'text-yellow-900' : 'text-green-900'
            }`}>
                {item.quantity} <span className="text-base font-normal opacity-75">Units</span>
            </div>
         </div>

         {/* Meta Card */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center space-y-3">
             <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                   <Hash size={16} /> HSN Code
                </span>
                <span className="font-medium">{item.hsnCode}</span>
             </div>
             {item.barcode && (
               <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-gray-500 text-sm">
                     <ScanBarcode size={16} /> Barcode
                  </span>
                  <span className="font-mono bg-slate-100 px-2 rounded text-xs py-0.5">{item.barcode}</span>
               </div>
             )}
             <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                   <Clock size={16} /> Last Updated
                </span>
                <span className="font-medium text-xs">{new Date(item.lastUpdated).toLocaleDateString()}</span>
             </div>
         </div>
      </div>

      {/* Price History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
               <TrendingUp className="text-blue-600" size={20} /> Price History
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{history.length} updates</span>
         </div>

         {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
               No price history available yet.
            </div>
         ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                     <tr>
                        <th className="px-6 py-4">Date Changed</th>
                        <th className="px-6 py-4 text-right">Old Price</th>
                        <th className="px-6 py-4 text-center">Change</th>
                        <th className="px-6 py-4 text-right">New Price</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {history.map((entry) => {
                        const diff = entry.newPrice - entry.oldPrice;
                        const isIncrease = diff > 0;
                        return (
                           <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-gray-500">
                                 {new Date(entry.changeDate).toLocaleDateString()}
                                 <span className="text-xs text-gray-400 block">{new Date(entry.changeDate).toLocaleTimeString()}</span>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-600">₹{entry.oldPrice}</td>
                              <td className="px-6 py-4 text-center">
                                 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                    isIncrease ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                 }`}>
                                    {isIncrease ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                    {isIncrease ? '+' : ''}₹{diff}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-gray-900">₹{entry.newPrice}</td>
                           </tr>
                        );
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