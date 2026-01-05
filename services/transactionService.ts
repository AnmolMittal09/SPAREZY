
import { supabase } from './supabase';
import { Invoice, Role, Transaction, TransactionStatus, TransactionType, RequestStatus, PaymentStatus } from '../types';

// --- HELPERS ---

const mapDBToTransaction = (item: any): Transaction => ({
  id: item.id,
  partNumber: item.part_number,
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
  if (!supabase) return { success: false, message: "Supabase client not connected." };

  const createdByRole = transactions[0].createdByRole;
  
  // Logic Update: SALES and RETURNS are immediate physical movements. 
  // We mark them APPROVED immediately so stock updates, even if payment is PENDING (Credit).
  // PURCHASES (incoming items) from Managers stay PENDING for Owner verification.
  const getInitialStatus = (type: TransactionType) => {
    if (createdByRole === Role.OWNER) return TransactionStatus.APPROVED;
    if (type === TransactionType.SALE || type === TransactionType.RETURN) return TransactionStatus.APPROVED;
    return TransactionStatus.PENDING;
  };

  try {
    if (transactions.length === 0) return { success: true };

    // 1. Pre-Validation (Stock Check for Sales)
    const saleTransactions = transactions.filter(t => t.type === TransactionType.SALE);
    if (saleTransactions.length > 0) {
        const partNumbers = [...new Set(saleTransactions.map(t => t.partNumber))];
        const { data: stocks, error } = await supabase
            .from('inventory')
            .select('part_number, quantity')
            .in('part_number', partNumbers);
        
        if (error) throw new Error(error.message);

        if (stocks) {
            const stockMap = new Map<string, number>();
            stocks.forEach((s: any) => stockMap.set(s.part_number.toLowerCase(), s.quantity));

            for (const tx of saleTransactions) {
                const currentStock = stockMap.get(tx.partNumber.toLowerCase());
                if (currentStock === undefined || tx.quantity > currentStock) {
                    return { 
                        success: false, 
                        message: `Insufficient stock for part '${tx.partNumber}'. Available: ${currentStock || 0}, Requested: ${tx.quantity}` 
                    };
                }
            }
        }
    }

    // 2. Insert Transactions
    const dbRows = transactions.map(t => {
      const status = getInitialStatus(t.type);
      return {
        part_number: t.partNumber,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        paid_amount: t.paid_amount || 0,
        customer_name: t.customer_name,
        status: status,
        payment_status: t.payment_status || 'PAID',
        created_by_role: t.createdByRole,
        related_transaction_id: t.related_transaction_id
      };
    });

    const { error: insertError } = await supabase.from('transactions').insert(dbRows);
    if (insertError) throw new Error(insertError.message);

    // 3. Update Inventory for immediately APPROVED transactions
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const status = getInitialStatus(tx.type);
      
      if (status === TransactionStatus.APPROVED && tx.type !== TransactionType.PURCHASE_ORDER) {
         await updateStockForTransaction(tx.partNumber, tx.type, tx.quantity);
         if (tx.type === TransactionType.PURCHASE) {
            await fulfillRequisitionsForPart(tx.partNumber);
         }
      }
    }
    
    return { success: true };

  } catch (error: any) {
    console.error("Create Bulk Transaction Error:", error);
    return { success: false, message: error.message };
  }
};

const fulfillRequisitionsForPart = async (partNumber: string) => {
  if (!supabase) return;
  const { data: requests, error } = await supabase
    .from('stock_requests')
    .select('id')
    .ilike('part_number', partNumber)
    .in('status', [RequestStatus.PENDING, RequestStatus.ORDERED]);
  if (error || !requests || requests.length === 0) return;
  const ids = requests.map(r => r.id);
  await supabase.from('stock_requests').update({ status: RequestStatus.COMPLETED }).in('id', ids);
};

export const fetchTransactions = async (
  status?: TransactionStatus | TransactionStatus[], 
  type?: TransactionType | TransactionType[]
): Promise<Transaction[]> => {
  if (!supabase) return [];
  let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });
  if (status) {
    if (Array.isArray(status)) query = query.in('status', status);
    else query = query.eq('status', status);
  } else {
    query = query.limit(500);
  }
  if (type) {
    if (Array.isArray(type)) query = query.in('type', type);
    else query = query.eq('type', type);
  }
  const { data, error } = await query;
  if (error) return [];
  return data.map(mapDBToTransaction);
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
  if (!supabase) throw new Error("Database not connected");
  if (type === TransactionType.SALE) {
      const { data: item } = await supabase.from('inventory').select('quantity').ilike('part_number', partNumber).single();
      if (!item || item.quantity < quantity) throw new Error(`Insufficient stock for approval.`);
  }
  const { error: txError } = await supabase.from('transactions').update({ status: TransactionStatus.APPROVED }).eq('id', id);
  if (txError) throw new Error(txError.message);
  if (type !== TransactionType.PURCHASE_ORDER) {
    await updateStockForTransaction(partNumber, type, quantity);
    if (type === TransactionType.PURCHASE) await fulfillRequisitionsForPart(partNumber);
  }
};

export const rejectTransaction = async (id: string): Promise<void> => {
  if (!supabase) throw new Error("Database not connected");
  const { error } = await supabase.from('transactions').update({ status: TransactionStatus.REJECTED }).eq('id', id);
  if (error) throw new Error(error.message);
};

const updateStockForTransaction = async (partNumber: string, type: TransactionType, quantity: number) => {
  if (!supabase) return;
  const { data: items } = await supabase.from('inventory').select('quantity, part_number, is_archived').ilike('part_number', partNumber).limit(1);
  if (!items || items.length === 0) return;
  const dbItem = items[0];
  const currentQty = dbItem.quantity;
  let newQty = currentQty;
  if (type === TransactionType.SALE) newQty = currentQty - quantity;
  else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) newQty = currentQty + quantity;
  if (newQty < 0 && type === TransactionType.SALE) newQty = 0;
  const shouldUnarchive = dbItem.is_archived && newQty > 0;
  const updatePayload: any = { quantity: newQty, last_updated: new Date().toISOString() };
  if (shouldUnarchive) updatePayload.is_archived = false;
  await supabase.from('inventory').update(updatePayload).eq('part_number', dbItem.part_number);
};

export const updateBillPayment = async (createdAt: string, customerName: string, additionalAmount: number): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };
  try {
    const { data: items, error: fetchError } = await supabase.from('transactions').select('*').eq('created_at', createdAt).eq('customer_name', customerName).eq('type', 'SALE');
    if (fetchError || !items || items.length === 0) throw new Error("Bill not found.");
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
    if (t.type === TransactionType.SALE) {
      totalSales += val; salesCount++;
      const pnKey = t.partNumber.toUpperCase();
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
  const { data, error } = await supabase.from('transactions').select('*').eq('type', 'SALE').eq('status', 'APPROVED').is('invoice_id', null).order('created_at', { ascending: false });
  if (error || !data) return [];
  const saleIds = data.map(s => s.id);
  const { data: returns } = await supabase.from('transactions').select('related_transaction_id, quantity').eq('type', 'RETURN').eq('status', 'APPROVED').in('related_transaction_id', saleIds);
  const returnMap = new Map<string, number>();
  if (returns) returns.forEach((r: any) => { const current = returnMap.get(r.related_transaction_id) || 0; returnMap.set(r.related_transaction_id, current + r.quantity); });
  const validData = data.filter((s: any) => { const returned = returnMap.get(s.id) || 0; return s.quantity > returned; });
  return validData.map(mapDBToTransaction);
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('invoices').select('*').order('date', { ascending: false });
  if (error || !data) return [];
  // Fix: changed property name tax_amount to taxAmount to match Invoice interface
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
