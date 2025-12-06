import React, { useEffect, useState } from 'react';
import { Role, Transaction, TransactionStatus, TransactionType, User } from '../types';
import { 
  createTransaction, 
  fetchTransactions, 
  approveTransaction, 
  rejectTransaction 
} from '../services/transactionService';
import { 
  ShoppingCart, 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  History, 
  PlusCircle, 
  Search,
  Loader2
} from 'lucide-react';

interface Props {
  user: User;
}

const DailyTransactions: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'PENDING' | 'HISTORY'>('NEW');
  const [pendingList, setPendingList] = useState<Transaction[]>([]);
  const [historyList, setHistoryList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    partNumber: '',
    type: TransactionType.SALE,
    quantity: 1,
    price: 0,
    customerName: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'PENDING') loadPending();
    if (activeTab === 'HISTORY') loadHistory();
  }, [activeTab]);

  const loadPending = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.PENDING);
    setPendingList(data);
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions(); // Fetch all non-pending
    setHistoryList(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    const res = await createTransaction({
      ...formData,
      createdByRole: user.role
    });

    if (res.success) {
      setMsg({ type: 'success', text: user.role === Role.MANAGER ? 'Submitted for approval.' : 'Transaction recorded successfully.' });
      setFormData({ ...formData, partNumber: '', quantity: 1, price: 0, customerName: '' });
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to submit.' });
    }
    setSubmitting(false);
  };

  const handleApprove = async (tx: Transaction) => {
    try {
      await approveTransaction(tx.id, tx.partNumber, tx.type, tx.quantity);
      loadPending(); // Refresh list
    } catch (err) {
      alert("Error approving transaction");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectTransaction(id);
      loadPending(); // Refresh list
    } catch (err) {
      alert("Error rejecting transaction");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Transactions</h1>
          <p className="text-gray-500">Record Sales, Purchases, and manage stock flow.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setActiveTab('NEW')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'NEW' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <PlusCircle size={18} /> New Entry
        </button>
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'PENDING' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Clock size={18} /> Pending Approvals
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <History size={18} /> History
        </button>
      </div>

      {/* CONTENT: NEW ENTRY */}
      {activeTab === 'NEW' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            Record New Transaction
          </h3>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex gap-4">
               <label className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors ${formData.type === TransactionType.SALE ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                  <input 
                    type="radio" 
                    name="type" 
                    className="w-4 h-4 text-green-600"
                    checked={formData.type === TransactionType.SALE}
                    onChange={() => setFormData({...formData, type: TransactionType.SALE})}
                  />
                  <div className="flex items-center gap-2 text-green-700 font-bold">
                    <ShoppingCart size={20} /> SALE (Out)
                  </div>
               </label>
               <label className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors ${formData.type === TransactionType.PURCHASE ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                  <input 
                    type="radio" 
                    name="type" 
                    className="w-4 h-4 text-blue-600"
                    checked={formData.type === TransactionType.PURCHASE}
                    onChange={() => setFormData({...formData, type: TransactionType.PURCHASE})}
                  />
                  <div className="flex items-center gap-2 text-blue-700 font-bold">
                    <Truck size={20} /> PURCHASE (In)
                  </div>
               </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Part Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  required
                  placeholder="e.g. HY-AIR-001"
                  value={formData.partNumber}
                  onChange={(e) => setFormData({...formData, partNumber: e.target.value})}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {formData.type === TransactionType.SALE ? 'Customer Name' : 'Supplier Name'}
              </label>
              <input 
                type="text" 
                placeholder={formData.type === TransactionType.SALE ? "Walk-in Customer" : "Distributor Name"}
                value={formData.customerName}
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Quantity</label>
              <input 
                type="number" 
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                 Price (Per Unit)
              </label>
              <input 
                type="number" 
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Submit {user.role === Role.MANAGER ? 'for Approval' : 'Transaction'}
              </button>
              
              {msg && (
                <div className={`mt-4 p-3 rounded-lg text-sm text-center ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {msg.text}
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* CONTENT: PENDING */}
      {activeTab === 'PENDING' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
          ) : pendingList.length === 0 ? (
             <div className="p-12 text-center text-gray-500">No pending approvals found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Part No</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === TransactionType.SALE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                           {tx.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{tx.partNumber}</td>
                      <td className="px-6 py-4">{tx.quantity}</td>
                      <td className="px-6 py-4">₹{tx.price}</td>
                      <td className="px-6 py-4 text-gray-600">{tx.customerName || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {user.role === Role.OWNER ? (
                          <div className="flex items-center justify-center gap-2">
                             <button 
                               onClick={() => handleApprove(tx)}
                               className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors" 
                               title="Approve"
                             >
                               <CheckCircle2 size={18} />
                             </button>
                             <button 
                               onClick={() => handleReject(tx.id)}
                               className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition-colors"
                               title="Reject"
                             >
                               <XCircle size={18} />
                             </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Waiting Approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
          ) : historyList.length === 0 ? (
             <div className="p-12 text-center text-gray-500">No transaction history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Part No</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === TransactionType.SALE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                           {tx.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{tx.partNumber}</td>
                      <td className="px-6 py-4">{tx.quantity}</td>
                      <td className="px-6 py-4">₹{tx.price}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                           tx.status === TransactionStatus.APPROVED 
                             ? 'bg-green-50 text-green-700' 
                             : tx.status === TransactionStatus.REJECTED 
                               ? 'bg-red-50 text-red-700' 
                               : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default DailyTransactions;
