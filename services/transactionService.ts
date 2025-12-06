
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
 *   created_at timestamptz default now()
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
  createdAt: item.created_at
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

  // Assume all transactions in a batch have the same creator role
  const createdByRole = transactions[0].createdByRole;
  
  // Logic: Owners auto-approve, Managers are Pending
  const initialStatus = createdByRole === Role.OWNER 
    ? TransactionStatus.APPROVED 
    : TransactionStatus.PENDING;

  const dbRows = transactions.map(t => ({
    part_number: t.partNumber,
    type: t.type,
    quantity: t.quantity,
    price: t.price,
    customer_name: t.customerName,
    status: initialStatus,
    created_by_role: t.createdByRole
  }));

  const { error } = await supabase.from('transactions').insert(dbRows);

  if (error) {
    return { success: false, message: error.message };
  }

  // If auto-approved (Owner), update stock immediately
  if (initialStatus === TransactionStatus.APPROVED) {
    // We process these sequentially to ensure stock accuracy
    // In a robust backend, this would be a Postgres Trigger or Function
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
  // .ilike ensures 'hy-001' finds 'HY-001'
  const { data: items } = await supabase
    .from('inventory')
    .select('quantity, part_number')
    .ilike('part_number', partNumber) 
    .limit(1);

  if (!items || items.length === 0) {
    // Item doesn't exist. If it's a purchase or return, maybe we should create it?
    // For now, we skip. The user should add the item in the "Update Stock" page first.
    return;
  }

  const dbItem = items[0];
  const currentQty = dbItem.quantity;
  let newQty = currentQty;

  if (type === TransactionType.SALE) {
    newQty = currentQty - quantity;
  } else if (type === TransactionType.PURCHASE || type === TransactionType.RETURN) {
    // Purchase adds stock, Return also adds stock back
    newQty = currentQty + quantity;
  }

  // Prevent negative stock for sales
  if (newQty < 0 && type === TransactionType.SALE) newQty = 0;

  // Update using the ACTUAL casing found in DB to ensure match
  await supabase
    .from('inventory')
    .update({ quantity: newQty, last_updated: new Date().toISOString() })
    .eq('part_number', dbItem.part_number);
};

// Analytics Helper
export interface AnalyticsData {
  totalSales: number;
  totalReturns: number;
  totalPurchases: number;
  netRevenue: number;
  salesCount: number;
  returnCount: number;
}

export const fetchAnalytics = async (startDate: Date, endDate: Date): Promise<AnalyticsData> => {
  if (!supabase) return { totalSales: 0, totalReturns: 0, totalPurchases: 0, netRevenue: 0, salesCount: 0, returnCount: 0 };

  const { data, error } = await supabase
    .from('transactions')
    .select('type, price, quantity, status')
    .eq('status', 'APPROVED')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error || !data) {
    console.error("Analytics fetch error", error);
    return { totalSales: 0, totalReturns: 0, totalPurchases: 0, netRevenue: 0, salesCount: 0, returnCount: 0 };
  }

  let totalSales = 0;
  let totalReturns = 0;
  let totalPurchases = 0;
  let salesCount = 0;
  let returnCount = 0;

  data.forEach((t: any) => {
    const val = (t.price || 0) * (t.quantity || 0);
    if (t.type === TransactionType.SALE) {
      totalSales += val;
      salesCount += 1;
    } else if (t.type === TransactionType.RETURN) {
      totalReturns += val;
      returnCount += 1;
    } else if (t.type === TransactionType.PURCHASE) {
      totalPurchases += val;
    }
  });

  return {
    totalSales,
    totalReturns,
    totalPurchases,
    netRevenue: totalSales - totalReturns, // Revenue minus refunds
    salesCount,
    returnCount
  };
};