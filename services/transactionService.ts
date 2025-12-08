
import { supabase } from './supabase';
import { Invoice, Role, Transaction, TransactionStatus, TransactionType } from '../types';

const TRANSACTION_KEY = 'sparezy_transactions_v1';
const INVOICE_KEY = 'sparezy_invoices_v1';
const INVENTORY_KEY = 'sparezy_inventory_v1';

// --- HELPERS FOR LOCAL STORAGE ---
const getLocalTransactions = (): Transaction[] => {
  const str = localStorage.getItem(TRANSACTION_KEY);
  return str ? JSON.parse(str) : [];
};

const saveLocalTransactions = (data: Transaction[]) => {
  localStorage.setItem(TRANSACTION_KEY, JSON.stringify(data));
};

const getLocalInvoices = (): Invoice[] => {
  const str = localStorage.getItem(INVOICE_KEY);
  return str ? JSON.parse(str) : [];
};

const saveLocalInvoices = (data: Invoice[]) => {
  localStorage.setItem(INVOICE_KEY, JSON.stringify(data));
};

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


const mapDBToTransaction = (item: any): Transaction => ({
  id: item.id,
  partNumber: item.part_number,
  type: item.type as TransactionType,
  quantity: item.quantity,
  price: item.price,
  customerName: item.customer_name,
  status: item.status as TransactionStatus,
  createdByRole: item.created_by_role as Role,
  createdAt: item.created_at,
  relatedTransactionId: item.related_transaction_id,
  invoiceId: item.invoice_id
});

export const createTransaction = async (
  transaction: Omit<Transaction, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; message?: string }> => {
  return createBulkTransactions([transaction]);
};

export const createBulkTransactions = async (
  transactions: Omit<Transaction, 'id' | 'status' | 'createdAt'>[]
): Promise<{ success: boolean; message?: string }> => {
  
  const createdByRole = transactions[0].createdByRole;
  const initialStatus = (createdByRole === Role.OWNER)
    ? TransactionStatus.APPROVED 
    : TransactionStatus.PENDING;

  if (transactions.length === 0) return { success: true };

  // --- SUPABASE IMPLEMENTATION ---
  if (supabase) {
    // 1. Pre-Validation for Sales (Stock Check)
    const saleTransactions = transactions.filter(t => t.type === TransactionType.SALE);
    if (saleTransactions.length > 0) {
        const partNumbers = [...new Set(saleTransactions.map(t => t.partNumber))];
        const { data: stocks, error } = await supabase
            .from('inventory')
            .select('part_number, quantity')
            .in('part_number', partNumbers);
        
        if (!error && stocks) {
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
    const dbRows = transactions.map(t => ({
      part_number: t.partNumber,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      customer_name: t.customerName,
      status: initialStatus,
      created_by_role: t.createdByRole,
      related_transaction_id: t.relatedTransactionId
    }));

    const { error } = await supabase.from('transactions').insert(dbRows);
    if (error) return { success: false, message: error.message };

    // 3. Update Inventory (if Approved)
    if (initialStatus === TransactionStatus.APPROVED) {
      for (const tx of transactions) {
         if (tx.type !== TransactionType.PURCHASE_ORDER) {
           await updateStockForTransaction(tx.partNumber, tx.type, tx.quantity);
         }
      }
    }
    return { success: true };
  }

  // --- LOCAL STORAGE FALLBACK ---
  await delay(300);
  const currentTx = getLocalTransactions();
  const inventoryStr = localStorage.getItem(INVENTORY_KEY);
  const inventory = inventoryStr ? JSON.parse(inventoryStr) : [];

  // 1. Stock Check
  const saleTransactions = transactions.filter(t => t.type === TransactionType.SALE);
  for (const tx of saleTransactions) {
     const item = inventory.find((i: any) => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
     if (!item || tx.quantity > item.quantity) {
        return { success: false, message: `Insufficient stock locally for ${tx.partNumber}` };
     }
  }

  // 2. Insert
  const newTxRecords: Transaction[] = transactions.map(t => ({
     ...t,
     id: crypto.randomUUID(),
     status: initialStatus,
     createdAt: new Date().toISOString()
  }));
  
  saveLocalTransactions([...newTxRecords, ...currentTx]); // Prepend new

  // 3. Update Stock (if Approved)
  if (initialStatus === TransactionStatus.APPROVED) {
     for (const tx of transactions) {
        if (tx.type !== TransactionType.PURCHASE_ORDER) {
          await updateStockLocal(tx.partNumber, tx.type, tx.quantity);
        }
     }
  }

  return { success: true };
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
    } else {
      query = query.limit(200);
    }

    if (type) {
      if (Array.isArray(type)) query = query.in('type', type);
      else query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
    return data.map(mapDBToTransaction);
  }

  // --- LOCAL STORAGE FALLBACK ---
  await delay(200);
  let all = getLocalTransactions();
  
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    all = all.filter(t => statuses.includes(t.status));
  }
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    all = all.filter(t => types.includes(t.type));
  }
  
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const fetchCustomerTransactions = async (customerName: string): Promise<Transaction[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .ilike('customer_name', customerName)
      .order('created_at', { ascending: false });
      
    if (error) return [];
    return data.map(mapDBToTransaction);
  }
  
  // Local Storage Fallback
  const all = getLocalTransactions();
  return all.filter(t => t.customerName?.toLowerCase() === customerName.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const approveTransaction = async (id: string, partNumber: string, type: TransactionType, quantity: number): Promise<void> => {
  if (supabase) {
    // 1. Double check stock if Sale
    if (type === TransactionType.SALE) {
        const { data: item } = await supabase
            .from('inventory')
            .select('quantity')
            .ilike('part_number', partNumber)
            .single();
        if (!item || item.quantity < quantity) {
            throw new Error(`Cannot approve: Insufficient stock. Available: ${item?.quantity || 0}`);
        }
    }

    // 2. Update Status
    const { error: txError } = await supabase.from('transactions').update({ status: TransactionStatus.APPROVED }).eq('id', id);
    if (txError) throw new Error(txError.message);

    // 3. Update Stock
    if (type !== TransactionType.PURCHASE_ORDER) {
      await updateStockForTransaction(partNumber, type, quantity);
    }
    return;
  }

  // --- LOCAL STORAGE FALLBACK ---
  const all = getLocalTransactions();
  const txIndex = all.findIndex(t => t.id === id);
  if (txIndex === -1) throw new Error("Transaction not found locally");
  
  if (type === TransactionType.SALE) {
      const invStr = localStorage.getItem(INVENTORY_KEY);
      const inventory = invStr ? JSON.parse(invStr) : [];
      const item = inventory.find((i: any) => i.partNumber.toLowerCase() === partNumber.toLowerCase());
      if (!item || item.quantity < quantity) {
          throw new Error("Local stock insufficient");
      }
  }

  all[txIndex].status = TransactionStatus.APPROVED;
  saveLocalTransactions(all);
  
  if (type !== TransactionType.PURCHASE_ORDER) {
    await updateStockLocal(partNumber, type, quantity);
  }
};

export const rejectTransaction = async (id: string): Promise<void> => {
  if (supabase) {
    const { error } = await supabase.from('transactions').update({ status: TransactionStatus.REJECTED }).eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  
  const all = getLocalTransactions();
  const txIndex = all.findIndex(t => t.id === id);
  if (txIndex > -1) {
    all[txIndex].status = TransactionStatus.REJECTED;
    saveLocalTransactions(all);
  }
};

// --- STOCK UPDATE HELPERS ---

const updateStockForTransaction = async (partNumber: string, type: TransactionType, quantity: number) => {
  // Supabase logic
  const { data: items } = await supabase!
    .from('inventory')
    .select('quantity, part_number')
    .ilike('part_number', partNumber) 
    .limit(1);

  if (!items || items.length === 0) return;

  const dbItem = items[0];
  const currentQty = dbItem.quantity;
  let newQty = currentQty;

  if (type === TransactionType.SALE) newQty = currentQty - quantity;
  else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) newQty = currentQty + quantity;

  if (newQty < 0 && type === TransactionType.SALE) newQty = 0;

  await supabase!
    .from('inventory')
    .update({ quantity: newQty, last_updated: new Date().toISOString() })
    .eq('part_number', dbItem.part_number);
};

const updateStockLocal = async (partNumber: string, type: TransactionType, quantity: number) => {
  const invStr = localStorage.getItem(INVENTORY_KEY);
  const inventory = invStr ? JSON.parse(invStr) : [];
  const index = inventory.findIndex((i: any) => i.partNumber.toLowerCase() === partNumber.toLowerCase());
  
  if (index > -1) {
      const item = inventory[index];
      let newQty = item.quantity;
      if (type === TransactionType.SALE) newQty -= quantity;
      else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) newQty += quantity;
      
      if (newQty < 0) newQty = 0;
      
      inventory[index] = { ...item, quantity: newQty, lastUpdated: new Date().toISOString() };
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
  }
};

export interface SoldItemStats {
  partNumber: string;
  name: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface AnalyticsData {
  totalSales: number;
  totalReturns: number;
  totalPurchases: number;
  netRevenue: number;
  salesCount: number;
  returnCount: number;
  soldItems: SoldItemStats[];
}

export const fetchAnalytics = async (startDate: Date, endDate: Date): Promise<AnalyticsData> => {
  let rawData: Transaction[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('transactions')
      .select('part_number, type, price, quantity, status')
      .eq('status', 'APPROVED')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    if (!error && data) rawData = data.map(mapDBToTransaction);
  } else {
    const all = getLocalTransactions();
    rawData = all.filter(t => 
       t.status === TransactionStatus.APPROVED &&
       new Date(t.createdAt) >= startDate &&
       new Date(t.createdAt) <= endDate
    );
  }

  let totalSales = 0;
  let totalReturns = 0;
  let totalPurchases = 0;
  let salesCount = 0;
  let returnCount = 0;
  const soldItemsMap = new Map<string, { qty: number, rev: number }>();

  rawData.forEach(t => {
    const val = (t.price || 0) * (t.quantity || 0);
    if (t.type === TransactionType.SALE) {
      totalSales += val;
      salesCount++;
      const pnKey = t.partNumber.toUpperCase();
      const current = soldItemsMap.get(pnKey) || { qty: 0, rev: 0 };
      soldItemsMap.set(pnKey, { qty: current.qty + t.quantity, rev: current.rev + val });
    } else if (t.type === TransactionType.RETURN) {
      totalReturns += val;
      returnCount++;
    } else if (t.type === TransactionType.PURCHASE) {
      totalPurchases += val;
    }
  });

  const soldItems: SoldItemStats[] = [];
  soldItemsMap.forEach((val, key) => {
     soldItems.push({
       partNumber: key,
       name: '', 
       quantitySold: val.qty,
       totalRevenue: val.rev
     });
  });

  return {
    totalSales,
    totalReturns,
    totalPurchases,
    netRevenue: totalSales - totalReturns,
    salesCount,
    returnCount,
    soldItems
  };
};

// --- INVOICE RELATED FUNCTIONS ---

export const fetchUninvoicedSales = async (): Promise<Transaction[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'SALE')
      .eq('status', 'APPROVED')
      .is('invoice_id', null) 
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch uninvoiced sales error:", error);
      return [];
    }
    return data ? data.map(mapDBToTransaction);
  }

  // Local Storage
  const all = getLocalTransactions();
  return all.filter(t => 
    t.type === TransactionType.SALE && 
    t.status === TransactionStatus.APPROVED && 
    !t.invoiceId
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('date', { ascending: false });

    if (error || !data) return [];

    return data.map((i: any) => ({
       id: i.id,
       invoiceNumber: i.invoice_number,
       date: i.date,
       customerName: i.customer_name,
       customerPhone: i.customer_phone,
       customerAddress: i.customer_address,
       customerGst: i.customer_gst,
       totalAmount: i.total_amount,
       taxAmount: i.tax_amount,
       paymentMode: i.payment_mode,
       itemsCount: i.items_count,
       generatedBy: i.generated_by
    }));
  }

  // Local Storage
  const inv = getLocalInvoices();
  return inv.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const generateTaxInvoiceRecord = async (
  transactionIds: string[], 
  customerDetails: { name: string, phone: string, address: string, gst: string, paymentMode: string },
  totals: { amount: number, tax: number },
  userRole: string
): Promise<{ success: boolean, invoice?: Invoice, message?: string }> => {
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  
  // --- SUPABASE ---
  if (supabase) {
    try {
      const { data: invoiceData, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_name: customerDetails.name,
          customer_phone: customerDetails.phone,
          customer_address: customerDetails.address,
          customer_gst: customerDetails.gst,
          total_amount: totals.amount,
          tax_amount: totals.tax,
          payment_mode: customerDetails.paymentMode,
          items_count: transactionIds.length,
          generated_by: userRole
        })
        .select()
        .single();

      if (invError || !invoiceData) throw new Error(invError?.message || "Failed to create invoice");

      const { error: txError } = await supabase
        .from('transactions')
        .update({ invoice_id: invoiceData.id })
        .in('id', transactionIds);

      if (txError) throw new Error("Failed to link items to invoice");

      return { 
        success: true, 
        invoice: {
          id: invoiceData.id,
          invoiceNumber: invoiceData.invoice_number,
          date: invoiceData.date,
          customerName: invoiceData.customer_name,
          customerPhone: invoiceData.customer_phone,
          customerAddress: invoiceData.customer_address,
          customerGst: invoiceData.customer_gst,
          totalAmount: invoiceData.total_amount,
          taxAmount: invoiceData.tax_amount,
          paymentMode: invoiceData.payment_mode as any,
          itemsCount: invoiceData.items_count,
          generatedBy: invoiceData.generated_by
        } 
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // --- LOCAL STORAGE ---
  const newInvoice: Invoice = {
    id: crypto.randomUUID(),
    invoiceNumber: invoiceNumber,
    date: new Date().toISOString(),
    customerName: customerDetails.name,
    customerPhone: customerDetails.phone,
    customerAddress: customerDetails.address,
    customerGst: customerDetails.gst,
    totalAmount: totals.amount,
    taxAmount: totals.tax,
    paymentMode: customerDetails.paymentMode as any,
    itemsCount: transactionIds.length,
    generatedBy: userRole
  };

  const invoices = getLocalInvoices();
  saveLocalInvoices([newInvoice, ...invoices]);

  const transactions = getLocalTransactions();
  const updatedTransactions = transactions.map(t => {
     if (transactionIds.includes(t.id)) {
        return { ...t, invoiceId: newInvoice.id };
     }
     return t;
  });
  saveLocalTransactions(updatedTransactions);

  return { success: true, invoice: newInvoice };
};
