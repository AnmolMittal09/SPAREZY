
import { supabase } from './supabase';
import { RequestStatus, StockRequest } from '../types';

export const createStockRequests = async (
  requests: { partNumber: string; quantity: number; requesterName: string }[]
): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: true };

  const payload = requests.map(r => ({
    part_number: r.partNumber,
    quantity_needed: r.quantity,
    requester_name: r.requesterName,
    status: RequestStatus.PENDING
  }));

  const { error } = await supabase.from('stock_requests').insert(payload);

  if (error) return { success: false, message: error.message };
  return { success: true };
};

export const fetchStockRequests = async (status?: RequestStatus): Promise<StockRequest[]> => {
  if (!supabase) return [];

  let query = supabase
    .from('stock_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    // Default limit for history
    query = query.limit(100);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    partNumber: row.part_number,
    quantityNeeded: row.quantity_needed,
    requesterName: row.requester_name,
    status: row.status as RequestStatus,
    createdAt: row.created_at
  }));
};

export const updateRequestStatus = async (ids: string[], status: RequestStatus): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('stock_requests')
    .update({ status })
    .in('id', ids);

  if (error) throw new Error(error.message);
};
