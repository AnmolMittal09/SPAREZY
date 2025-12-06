import { supabase } from './supabase';
import { Role, Transaction, TransactionStatus, TransactionType } from '../types';

/**
 * SQL SCHEMA FOR TRANSACTIONS:
 * 
 * create table transactions (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text not null,
 *   type text not null, -- 'SALE', 'PURCHASE', 'PURCHASE_ORDER'
 *   quantity int not null,
 *   price numeric,
 *   customer_name text,
 *   expected_delivery_date date, -- Added for Purchase Orders
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
  expectedDeliveryDate: item.expected_delivery_date,
  status: item.status as TransactionStatus,
  createdByRole: item.created_by_role as Role,
  createdAt: item.created_at,
});

export const createTransaction = async (
  transaction: Omit<Transaction, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; message?: string }> => {
  
  // If no Supabase, return mock success
  if (!supabase) {
    console.log("Mock Transaction Created:", transaction);
    return { success: true };
  }

  // Logic: Owners auto-approve, Managers are Pending
  // Note: Purchase Orders always start as PENDING usually, but if Owner creates it, we can auto-approve.
  const initialStatus = transaction.createdByRole === Role.OWNER 
    ? TransactionStatus.APPROVED 
    : TransactionStatus.PENDING;

  const { error } = await supabase.from('transactions').insert({
    part_number: transaction.partNumber,
    type: transaction.type,
    quantity: transaction.quantity,
    price: transaction.price,
    customer_name: transaction.customerName,
    expected_delivery_date: transaction.expectedDeliveryDate || null,
    status: initialStatus,
    created_by_role: transaction.createdByRole,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  // If auto-approved (Owner), update stock immediately
  if (initialStatus === TransactionStatus.APPROVED) {
    await updateStockForTransaction(transaction.partNumber, transaction.type, transaction.quantity);
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

  // 2. Update Inventory
  // Note: For PURCHASE_ORDER, approval implies the order is confirmed/received in this simplified workflow.
  await updateStockForTransaction(partNumber, type, quantity);
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

  // Fetch current item
  const { data: items } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('part_number', partNumber)
    .limit(1);

  if (!items || items.length === 0) {
    // If purchasing a new item that doesn't exist yet, we ignore update or could create.
    // Assuming item exists for now.
    return;
  }

  const currentQty = items[0].quantity;
  let newQty = currentQty;

  if (type === TransactionType.SALE) {
    newQty = currentQty - quantity;
  } else if (type === TransactionType.PURCHASE || type === TransactionType.PURCHASE_ORDER) {
    // Both Purchase and Approved POs increase stock
    newQty = currentQty + quantity;
  }

  // Prevent negative stock
  if (newQty < 0) newQty = 0;

  await supabase
    .from('inventory')
    .update({ quantity: newQty, last_updated: new Date().toISOString() })
    .eq('part_number', partNumber);
};