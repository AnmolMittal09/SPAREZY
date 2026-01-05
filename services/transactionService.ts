
import { supabase } from './supabase';
import { Invoice, Role, Transaction, TransactionStatus, TransactionType, RequestStatus, PaymentStatus, StockItem } from '../types';

const TX_STORAGE_KEY = 'sparezy_transactions_v1';
const INV_STORAGE_KEY = 'sparezy_inventory_v1';

// --- HELPERS ---

const mapDBToTransaction = (item: any): Transaction => ({
  id: item.id,
  partNumber: item.part_number.toUpperCase(),
  type: item.type as TransactionType,
  quantity: item.quantity,
  price: item.price,
  paidAmount: item.paid_amount,
  customerName: item.customer_name,
  status: item.status as TransactionStatus,
  paymentStatus: item.payment_status as PaymentStatus,
  createdByRole: item.created_by_role as Role,
  createdAt: item.created_at,
  relatedTransactionId: item.related_transaction_id,
  invoiceId: item.invoice_id
});

// --- CORE FUNCTIONS ---

export const createTransaction = async (
  transaction: Omit<Transaction, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; message?: string }> => {
  return createBulkTransactions([transaction]);
};

export const createBulkTransactions = async (
  transactions: Omit<Transaction, 'id' | 'status' | 'createdAt'>[]
): Promise<{ success: boolean; message?: string }> => {
  const createdByRole = transactions[0].createdByRole;
  
  const getInitialStatus = (type: TransactionType) => {
    if (createdByRole === Role.OWNER) return TransactionStatus.APPROVED;
    if (type === TransactionType.SALE || type === TransactionType.RETURN) return TransactionStatus.APPROVED;
    return TransactionStatus.PENDING;
  };

  if (supabase) {
    try {
      if (transactions.length === 0) return { success: true };

      // 1. Pre-Validation (Stock Check)
      const saleTransactions = transactions.filter(t => t.type === TransactionType.SALE);
      if (saleTransactions.length > 0) {
          const partNumbers = [...new Set(saleTransactions.map(t => t.partNumber.toUpperCase()))];
          const { data: stocks } = await supabase
              .from('inventory')
              .select('part_number, quantity')
              .in('part_number', partNumbers);
          
          if (stocks) {
              const stockMap = new Map<string, number>();
              stocks.forEach((s: any) => stockMap.set(s.part_number.toUpperCase(), s.quantity));
              for (const tx of saleTransactions) {
                  const currentStock = stockMap.get(tx.partNumber.toUpperCase()) || 0;
                  if (tx.quantity > currentStock) {
                      return { success: false, message: `Insufficient stock for '${tx.partNumber}'. Available: ${currentStock}` };
                  }
              }
          }
      }

      // 2. Insert Transactions
      const dbRows = transactions.map(t => ({
        part_number: t.partNumber.toUpperCase(),
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        paid_amount: t.paidAmount || 0,
        customer_name: t.customerName,
        status: getInitialStatus(t.type),
        payment_status: t.paymentStatus || 'PAID',
        created_by_role: t.createdByRole,
        related_transaction_id: t.relatedTransactionId
      }));

      const { error: insertError } = await supabase.from('transactions').insert(dbRows);
      if (insertError) throw new Error("Journal Error: " + insertError.message);

      // 3. Update Inventory immediately for APPROVED movements
      for (const tx of transactions) {
        const status = getInitialStatus(tx.type);
        if (status === TransactionStatus.APPROVED && tx.type !== TransactionType.PURCHASE_ORDER) {
           await updateStockForTransaction(tx.partNumber.toUpperCase(), tx.type, tx.quantity);
        }
      }
      return { success: true };
    } catch (error: any) {
      console.error("Supabase Transaction Error:", error);
      return { success: false, message: error.message };
    }
  }

  // --- OFFLINE FALLBACK ---
  const localTransactions: Transaction[] = JSON.parse(localStorage.getItem(TX_STORAGE_KEY) || '[]');
  const localInventory: StockItem[] = JSON.parse(localStorage.getItem(INV_STORAGE_KEY) || '[]');

  for (const t of transactions) {
    const status = getInitialStatus(t.type);
    const upperPN = t.partNumber.toUpperCase();
    const newTx: Transaction = {
      ...t,
      partNumber: upperPN,
      id: Math.random().toString(36).substring(7),
      status,
      createdAt: new Date().toISOString()
    };
    localTransactions.push(newTx);

    if (status === TransactionStatus.APPROVED) {
      const invIdx = localInventory.findIndex(i => i.partNumber.toUpperCase() === upperPN);
      if (invIdx > -1) {
        if (t.type === TransactionType.SALE) localInventory[invIdx].quantity -= t.quantity;
        else if (t.type === TransactionType.PURCHASE || t.type === TransactionType.RETURN) localInventory[invIdx].quantity += t.quantity;
        localInventory[invIdx].lastUpdated = new Date().toISOString();
        if (localInventory[invIdx].quantity < 0) localInventory[invIdx].quantity = 0;
      }
    }
  }

  localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(localTransactions));
  localStorage.setItem(INV_STORAGE_KEY, JSON.stringify(localInventory));
  return { success: true };
};

const updateStockForTransaction = async (partNumber: string, type: TransactionType, quantity: number) => {
  if (!supabase) return;
  
  const upperPN = partNumber.toUpperCase();
  
  // 1. Fetch current data
  const { data: items, error: fetchError } = await supabase
    .from('inventory')
    .select('quantity, part_number, is_archived')
    .ilike('part_number', upperPN)
    .limit(1);

  if (fetchError) throw new Error("Registry Access Failed: " + fetchError.message);
  if (!items || items.length === 0) throw new Error(`SKU ${upperPN} not found in inventory registry.`);
  
  const dbItem = items[0];
  let newQty = dbItem.quantity;

  if (type === TransactionType.SALE) newQty = dbItem.quantity - quantity;
  else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) newQty = dbItem.quantity + quantity;

  if (newQty < 0) newQty = 0;

  const updatePayload: any = { 
    quantity: newQty, 
    last_updated: new Date().toISOString() 
  };

  if (dbItem.is_archived && newQty > 0) {
    updatePayload.is_archived = false;
  }

  // 2. Perform the Update using EXACT case from DB
  const { error: updateError } = await supabase
    .from('inventory')
    .update(updatePayload)
    .eq('part_number', dbItem.part_number);

  if (updateError) {
    throw new Error(`Inventory Update Failed for ${dbItem.part_number}: ${updateError.message}`);
  }
};

export const fetchTransactions = async (
  status?: TransactionStatus | TransactionStatus[], 
  type?: TransactionType | TransactionType[]
): Promise<Transaction[]> => {
  if (supabase) {
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (status) {
      if (Array.isArray(status)) query = query.in('status', status);
      else query = query.eq('status', status);
    }
    if (type) {
      if (Array.isArray(type)) query = query.in('type', type);
      else query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) return [];
    return data.map(mapDBToTransaction);
  }
  
  const local: Transaction[] = JSON.parse(localStorage.getItem(TX_STORAGE_KEY) || '[]');
  return local.reverse();
};

export const fetchItemTransactions = async (partNumber: string): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .ilike('part_number', partNumber)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapDBToTransaction);
};

export const approveTransaction = async (id: string, partNumber: string, type: TransactionType, quantity: number): Promise<void> => {
  if (!supabase) return;
  const { error: txError } = await supabase.from('transactions').update({ status: TransactionStatus.APPROVED }).eq('id', id);
  if (txError) throw new Error(txError.message);
  if (type !== TransactionType.PURCHASE_ORDER) {
    await updateStockForTransaction(partNumber, type, quantity);
  }
};

export const rejectTransaction = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('transactions').update({ status: TransactionStatus.REJECTED }).eq('id', id);
};

export const updateBillPayment = async (createdAt: string, customerName: string, additionalAmount: number): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };
  try {
    const { data: items } = await supabase.from('transactions').select('*').eq('created_at', createdAt).eq('customer_name', customerName).eq('type', 'SALE');
    if (!items || items.length === 0) throw new Error("Bill not found.");
    const totalBillAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const currentPaidAmount = items.reduce((sum, i) => sum + i.paid_amount, 0);
    const newTotalPaid = Math.min(totalBillAmount, currentPaidAmount + additionalAmount);
    const finalPaymentStatus = newTotalPaid >= totalBillAmount ? 'PAID' : 'PENDING';
    for (const item of items) {
       const itemTotal = item.price * item.quantity;
       const proportion = totalBillAmount > 0 ? itemTotal / totalBillAmount : 0;
       const newItemPaid = newTotalPaid * proportion;
       await supabase.from('transactions').update({ paid_amount: newItemPaid, payment_status: finalPaymentStatus }).eq('id', item.id);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

export interface SoldItemStats { partNumber: string; name: string; quantitySold: number; totalRevenue: number; }
export interface AnalyticsData { totalSales: number; totalReturns: number; totalPurchases: number; netRevenue: number; salesCount: number; returnCount: number; soldItems: SoldItemStats[]; }

export const fetchAnalytics = async (startDate: Date, endDate: Date): Promise<AnalyticsData> => {
  const allTxs = await fetchTransactions(TransactionStatus.APPROVED);
  const filtered = allTxs.filter(t => {
     const d = new Date(t.createdAt);
     return d >= startDate && d <= endDate;
  });
  let totalSales = 0, totalReturns = 0, totalPurchases = 0, salesCount = 0, returnCount = 0;
  const soldItemsMap = new Map<string, { qty: number, rev: number }>();
  filtered.forEach(t => {
    const val = (t.price || 0) * (t.quantity || 0);
    const pnKey = t.partNumber.toUpperCase();
    if (t.type === TransactionType.SALE) {
      totalSales += val; salesCount++;
      const current = soldItemsMap.get(pnKey) || { qty: 0, rev: 0 };
      soldItemsMap.set(pnKey, { qty: current.qty + t.quantity, rev: current.rev + val });
    } else if (t.type === TransactionType.RETURN) {
      totalReturns += val; returnCount++;
    } else if (t.type === TransactionType.PURCHASE) {
      totalPurchases += val;
    }
  });
  const soldItems: SoldItemStats[] = [];
  soldItemsMap.forEach((val, key) => { soldItems.push({ partNumber: key, name: '', quantitySold: val.qty, totalRevenue: val.rev }); });
  return { totalSales, totalReturns, totalPurchases, netRevenue: totalSales - totalReturns, salesCount, returnCount, soldItems };
};

export const fetchUninvoicedSales = async (): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('transactions').select('*').eq('type', 'SALE').eq('status', 'APPROVED').is('invoice_id', null).order('created_at', { ascending: false });
  if (!data) return [];
  return data.map(mapDBToTransaction);
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('invoices').select('*').order('date', { ascending: false });
  if (!data) return [];
  return data.map((i: any) => ({
      id: i.id, invoiceNumber: i.invoice_number, date: i.date, customerName: i.customer_name,
      customerPhone: i.customer_phone, customerAddress: i.customer_address, customerGst: i.customer_gst,
      totalAmount: i.total_amount, paidAmount: i.paid_amount, taxAmount: i.tax_amount,
      paymentMode: i.payment_mode, itemsCount: i.items_count, generatedBy: i.generated_by
  }));
};

export const generateTaxInvoiceRecord = async (
  transactionIds: string[], 
  customerDetails: { name: string, phone: string, address: string, gst: string, paymentMode: string, paidAmount?: number },
  totals: { amount: number, tax: number },
  userRole: string
): Promise<{ success: boolean, invoice?: Invoice, message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  try {
    const { data: invoiceData, error: invError } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber, customer_name: customerDetails.name, customer_phone: customerDetails.phone,
        customer_address: customerDetails.address, customer_gst: customerDetails.gst, total_amount: totals.amount,
        paid_amount: customerDetails.paidAmount || 0, tax_amount: totals.tax, payment_mode: customerDetails.paymentMode.toUpperCase(), 
        items_count: transactionIds.length, generated_by: userRole
      }).select().single();
    if (invError || !invoiceData) throw new Error(invError?.message || "Failed to create invoice");
    const { error: txError } = await supabase.from('transactions').update({ invoice_id: invoiceData.id }).in('id', transactionIds);
    if (txError) throw new Error("Failed to link items to invoice");
    return { success: true, invoice: {
        id: invoiceData.id, invoiceNumber: invoiceData.invoice_number, date: invoiceData.date, customerName: invoiceData.customer_name,
        customerPhone: invoiceData.customer_phone, customerAddress: invoiceData.customer_address, customerGst: invoiceData.customer_gst,
        totalAmount: invoiceData.total_amount, paidAmount: invoiceData.paid_amount, taxAmount: invoiceData.tax_amount,
        paymentMode: invoiceData.payment_mode as any, itemsCount: invoiceData.items_count, generatedBy: invoiceData.generated_by
      } };
  } catch (err: any) { return { success: false, message: err.message }; }
};
