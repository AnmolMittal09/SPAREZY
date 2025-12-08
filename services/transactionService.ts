

import { supabase } from './supabase';
import { Role, Transaction, TransactionStatus, TransactionType } from '../types';

/**
 * SQL SCHEMA FOR TRANSACTIONS:
 * 
 * create table transactions (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text not null,
 *   type text not null, -- 'SALE' or 'PURCHASE'
 *   quantity int not null,
 *   price numeric,
 *   customer_name text,
 *   status text default 'PENDING',
 *   created_by_role text,
 *   created_at timestamptz default now(),
 *   related_transaction_id uuid
 * );
 */

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
  relatedTransactionId: item.related_transaction_id
});

export const createTransaction = async (
  transaction: Omit<Transaction, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; message?: string }> => {
  return createBulkTransactions([transaction]);
};

export const createBulkTransactions = async (
  transactions: Omit<Transaction, 'id' | 'status' | 'createdAt'>[]
): Promise<{ success: boolean; message?: string }> => {
  
  if (!supabase) {
    console.log("Mock Transactions Created:", transactions.length);
    return { success: true };
  }

  if (transactions.length === 0) return { success: true };

  // --- PRE-VALIDATION FOR SALES (Backend Check) ---
  const saleTransactions = transactions.filter(t => t.type === TransactionType.SALE);
  if (saleTransactions.length > 0) {
      // Fetch current stock for these items
      const partNumbers = saleTransactions.map(t => t.partNumber);
      // Create unique list for query
      const uniquePartNumbers = [...new Set(partNumbers)];

      // Note: Supabase .in() has a limit, but for daily batches usually fine. 
      const { data: stocks, error } = await supabase
          .from('inventory')
          .select('part_number, quantity')
          .in('part_number', uniquePartNumbers);
      
      if (!error && stocks) {
          // Create map for case-insensitive lookup: part_number -> quantity
          const stockMap = new Map<string, number>();
          stocks.forEach((s: any) => stockMap.set(s.part_number.toLowerCase(), s.quantity));

          // Check each sale
          for (const tx of saleTransactions) {
              const currentStock = stockMap.get(tx.partNumber.toLowerCase());
              // If item doesn't exist (stock 0) or quantity > stock
              if (currentStock === undefined || tx.quantity > currentStock) {
                  return { 
                      success: false, 
                      message: `Insufficient stock for part '${tx.partNumber}'. Available: ${currentStock || 0}, Requested: ${tx.quantity}` 
                  };
              }
          }
      }
  }

  // Assume all transactions in a batch have the same creator role
  const createdByRole = transactions[0].createdByRole;
  
  // Check if all items are returns (Managers can auto-approve returns)
  const isReturnBatch = transactions.every(t => t.type === TransactionType.RETURN);

  // Logic: Owners auto-approve everything. Managers auto-approve RETURNS.
  const initialStatus = (createdByRole === Role.OWNER || (createdByRole === Role.MANAGER && isReturnBatch))
    ? TransactionStatus.APPROVED 
    : TransactionStatus.PENDING;

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

  if (error) {
    return { success: false, message: error.message };
  }

  // If auto-approved, update stock immediately
  if (initialStatus === TransactionStatus.APPROVED) {
    // We process these sequentially to ensure stock accuracy
    for (const tx of transactions) {
       // Purchase Orders (Future delivery) do not affect current stock count immediately upon creation/approval
       if (tx.type !== TransactionType.PURCHASE_ORDER) {
         await updateStockForTransaction(tx.partNumber, tx.type, tx.quantity);
       }
    }
  }

  return { success: true };
};

export const fetchTransactions = async (status?: TransactionStatus): Promise<Transaction[]> => {
  if (!supabase) return [];

  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    // If fetching history, don't show pending
    query = query.neq('status', 'PENDING').limit(50);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data.map(mapDBToTransaction);
};

export const approveTransaction = async (id: string, partNumber: string, type: TransactionType, quantity: number): Promise<void> => {
  if (!supabase) return;

  // 0. Pre-Approval Validation for Sales
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

  // 1. Update Transaction Status
  const { error: txError } = await supabase
    .from('transactions')
    .update({ status: TransactionStatus.APPROVED })
    .eq('id', id);

  if (txError) throw new Error(txError.message);

  // 2. Update Inventory (if it's an immediate transaction)
  if (type !== TransactionType.PURCHASE_ORDER) {
    await updateStockForTransaction(partNumber, type, quantity);
  }
};

export const rejectTransaction = async (id: string): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .update({ status: TransactionStatus.REJECTED })
    .eq('id', id);

  if (error) throw new Error(error.message);
};

// Helper to adjust stock levels
const updateStockForTransaction = async (partNumber: string, type: TransactionType, quantity: number) => {
  if (!supabase) return;

  // Fetch current item (CASE INSENSITIVE)
  const { data: items } = await supabase
    .from('inventory')
    .select('quantity, part_number')
    .ilike('part_number', partNumber) 
    .limit(1);

  if (!items || items.length === 0) {
    return;
  }

  const dbItem = items[0];
  const currentQty = dbItem.quantity;
  let newQty = currentQty;

  if (type === TransactionType.SALE) {
    newQty = currentQty - quantity;
  } else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) {
    newQty = currentQty + quantity;
  }

  // Prevent negative stock for sales
  if (newQty < 0 && type === TransactionType.SALE) newQty = 0;

  await supabase
    .from('inventory')
    .update({ quantity: newQty, last_updated: new Date().toISOString() })
    .eq('part_number', dbItem.part_number);
};

// Analytics Helper
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
  if (!supabase) return { totalSales: 0, totalReturns: 0, totalPurchases: 0, netRevenue: 0, salesCount: 0, returnCount: 0, soldItems: [] };

  const { data, error } = await supabase
    .from('transactions')
    .select('part_number, type, price, quantity, status')
    .eq('status', 'APPROVED')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error || !data) {
    console.error("Analytics fetch error", error);
    return { totalSales: 0, totalReturns: 0, totalPurchases: 0, netRevenue: 0, salesCount: 0, returnCount: 0, soldItems: [] };
  }

  let totalSales = 0;
  let totalReturns = 0;
  let totalPurchases = 0;
  let salesCount = 0;
  let returnCount = 0;

  // Map to store sold items aggregation: Key = PartNumber
  const soldItemsMap = new Map<string, { qty: number, rev: number }>();

  data.forEach((t: any) => {
    const val = (t.price || 0) * (t.quantity || 0);
    
    if (t.type === TransactionType.SALE) {
      totalSales += val;
      salesCount += 1;
      
      const pnKey = t.part_number.toUpperCase();
      const current = soldItemsMap.get(pnKey) || { qty: 0, rev: 0 };
      soldItemsMap.set(pnKey, { qty: current.qty + t.quantity, rev: current.rev + val });

    } else if (t.type === TransactionType.RETURN) {
      totalReturns += val;
      returnCount += 1;
    } else if (t.type === TransactionType.PURCHASE) {
      totalPurchases += val;
    }
  });

  // Fetch Part Names for the sold items
  const distinctPartNumbers = Array.from(soldItemsMap.keys());
  let partNamesMap = new Map<string, string>();

  if (distinctPartNumbers.length > 0) {
    const { data: invData } = await supabase
      .from('inventory')
      .select('part_number, name')
      .in('part_number', distinctPartNumbers); 
    
    if (invData) {
      invData.forEach((i: any) => {
        partNamesMap.set(i.part_number.toUpperCase(), i.name);
      });
    }
  }

  const soldItems: SoldItemStats[] = [];
  soldItemsMap.forEach((val, key) => {
     soldItems.push({
       partNumber: key,
       name: partNamesMap.get(key) || 'Unknown Item',
       quantitySold: val.qty,
       totalRevenue: val.rev
     });
  });

  // Sort by Revenue Descending
  soldItems.sort((a, b) => b.totalRevenue - a.totalRevenue);

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

export const fetchSalesForReturn = async (search?: string): Promise<Transaction[]> => {
  if (!supabase) return [];

  // 1. Fetch Approved Sales
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('type', 'SALE')
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .limit(20);

  if (search && search.trim().length > 0) {
    query = query.or(`part_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data: sales, error } = await query;
  if (error || !sales) {
    return [];
  }

  // 2. Filter out items that have ALREADY been returned.
  const saleIds = sales.map(s => s.id);
  if (saleIds.length === 0) return [];

  const { data: returns } = await supabase
    .from('transactions')
    .select('related_transaction_id')
    .eq('type', 'RETURN')
    .in('related_transaction_id', saleIds);

  const returnedSaleIds = new Set((returns || []).map(r => r.related_transaction_id));
  const availableSales = sales.filter(s => !returnedSaleIds.has(s.id));

  return availableSales.map(mapDBToTransaction);
};
