
import { INITIAL_STOCK_DATA } from '../constants';
import { Brand, PriceHistoryEntry, StockItem, StockStats, UploadHistoryEntry } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'sparezy_inventory_v1';

// --- Types for Supabase DB Row (snake_case) ---
interface DBItem {
  id?: string;
  part_number: string;
  name: string;
  brand: string;
  hsn_code: string;
  quantity: number;
  min_stock_threshold: number;
  price: number;
  last_updated: string;
  is_archived: boolean;
}

// --- Mappers ---
const toAppItem = (dbItem: DBItem): StockItem => ({
  id: dbItem.id || '',
  partNumber: dbItem.part_number.toUpperCase().trim(),
  name: dbItem.name,
  brand: dbItem.brand as Brand,
  hsnCode: dbItem.hsn_code,
  quantity: dbItem.quantity,
  minStockThreshold: dbItem.min_stock_threshold,
  price: dbItem.price,
  lastUpdated: dbItem.last_updated,
  isArchived: dbItem.is_archived || false
});

const toDBItem = (item: Partial<StockItem>): Partial<DBItem> => {
  const dbItem: Partial<DBItem> = {};
  if (item.partNumber) dbItem.part_number = item.partNumber.toUpperCase().trim();
  if (item.name) dbItem.name = item.name;
  if (item.brand) dbItem.brand = item.brand;
  if (item.hsnCode) dbItem.hsn_code = item.hsnCode;
  if (item.quantity !== undefined) dbItem.quantity = item.quantity;
  if (item.minStockThreshold !== undefined) dbItem.min_stock_threshold = item.minStockThreshold;
  if (item.price !== undefined) dbItem.price = item.price;
  if (item.lastUpdated) dbItem.last_updated = item.lastUpdated;
  if (item.isArchived !== undefined) dbItem.is_archived = item.isArchived;
  return dbItem;
};

// Helper to simulate network delay for local testing
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFromLS = (): StockItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STOCK_DATA));
    return INITIAL_STOCK_DATA;
  }
  return JSON.parse(stored);
};

export const fetchInventory = async (): Promise<StockItem[]> => {
  if (supabase) {
    let allData: DBItem[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order('part_number', { ascending: true });
      
      if (error) {
        console.error('Supabase fetch error:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as DBItem[]);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        }
        page++;
      } else {
        hasMore = false;
      }
    }
    return allData.map(toAppItem);
  }

  await delay(300); 
  return getFromLS();
};

export const fetchItemDetails = async (partNumber: string): Promise<StockItem | null> => {
  const cleanPN = partNumber.toUpperCase().trim();
  if (supabase) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('part_number', cleanPN)
      .single();
    
    if (error || !data) return null;
    return toAppItem(data);
  }
  const items = getFromLS();
  return items.find(i => i.partNumber.toUpperCase() === cleanPN) || null;
};

export const toggleArchiveStatus = async (partNumber: string, isArchived: boolean): Promise<void> => {
  const cleanPN = partNumber.toUpperCase().trim();
  if (!supabase) return;
  
  const { error } = await supabase
    .from('inventory')
    .update({ is_archived: isArchived })
    .eq('part_number', cleanPN);

  if (error) throw new Error(error.message);
};

export const saveInventory = async (items: StockItem[]): Promise<void> => {
  if (supabase) return;
  await delay(300);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const bulkArchiveItems = async (partNumbers: string[], isArchived: boolean): Promise<void> => {
  const cleanPNs = partNumbers.map(p => p.toUpperCase().trim());
  if (supabase) {
    const BATCH_SIZE = 200;
    for (let i = 0; i < cleanPNs.length; i += BATCH_SIZE) {
      const batch = cleanPNs.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('inventory')
        .update({ is_archived: isArchived })
        .in('part_number', batch);

      if (error) throw new Error(error.message);
    }
    return;
  }

  await delay(500);
  const items = getFromLS();
  const idsToUpdate = new Set(cleanPNs);
  const updatedItems = items.map(item => {
    if (idsToUpdate.has(item.partNumber.toUpperCase())) {
      return { ...item, isArchived };
    }
    return item;
  });
  await saveInventory(updatedItems);
};

export const getStats = (items: StockItem[]): StockStats => {
  const activeItems = items.filter(i => !i.isArchived);
  return {
    totalItems: activeItems.reduce((acc, item) => acc + item.quantity, 0),
    totalValue: activeItems.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0),
    lowStockCount: activeItems.filter(i => i.quantity > 0 && i.quantity < i.minStockThreshold).length,
    zeroStockCount: activeItems.filter(i => i.quantity === 0).length,
  };
};

export interface UpdateResult {
  added: number;
  updated: number;
  priceUpdates: number;
  stockUpdates: number;
  errors: string[];
}

export const updateOrAddItems = async (
  newItems: Partial<StockItem>[], 
  metadata?: { fileName: string, mode: string }
): Promise<UpdateResult> => {
  const result: UpdateResult = { added: 0, updated: 0, priceUpdates: 0, stockUpdates: 0, errors: [] };

  if (supabase) {
    const partNumbers = newItems
      .map(i => i.partNumber?.toUpperCase().trim())
      .filter((pn): pn is string => !!pn);

    if (partNumbers.length === 0) {
      result.errors.push("No valid part numbers found.");
      return result;
    }

    let existingItemsMap = new Map<string, StockItem>();
    const FETCH_BATCH_SIZE = 200;
    
    for (let i = 0; i < partNumbers.length; i += FETCH_BATCH_SIZE) {
      const batch = partNumbers.slice(i, i + FETCH_BATCH_SIZE);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .in('part_number', batch);
        
      if (!error && data) {
        data.forEach((d: any) => {
          const item = toAppItem(d);
          existingItemsMap.set(item.partNumber.toUpperCase(), item);
        });
      }
    }

    if (metadata) {
      const snapshot = newItems.map(newItem => {
        if (!newItem.partNumber) return null;
        const key = newItem.partNumber.toUpperCase().trim();
        const existing = existingItemsMap.get(key);
        return {
          part_number: key,
          previous_state: existing ? toDBItem(existing) : null
        };
      }).filter(Boolean);

      const { error: histError } = await supabase.from('upload_history').insert({
        file_name: metadata.fileName,
        upload_mode: metadata.mode,
        item_count: snapshot.length,
        status: 'SUCCESS',
        snapshot_data: snapshot,
        created_at: new Date().toISOString()
      });
      if (histError) console.error("Failed to save history:", histError);
    }

    const upsertPayload: Partial<DBItem>[] = [];
    const priceHistoryPayload: any[] = [];

    newItems.forEach((newItem, index) => {
      if (!newItem.partNumber) {
        result.errors.push(`Row ${index + 1}: Missing Part Number`);
        return;
      }
      
      const cleanPN = newItem.partNumber.toUpperCase().trim();
      const existingItem = existingItemsMap.get(cleanPN);
      
      if (existingItem) {
        let itemChanged = false;
        
        if (newItem.quantity !== undefined && newItem.quantity !== existingItem.quantity) {
          result.stockUpdates++;
          itemChanged = true;
        }
        if (newItem.price !== undefined && newItem.price !== existingItem.price) {
          result.priceUpdates++;
          itemChanged = true;
          priceHistoryPayload.push({
            part_number: cleanPN,
            old_price: existingItem.price,
            new_price: newItem.price,
            change_date: new Date().toISOString()
          });
        }
        if ((newItem.name && newItem.name !== existingItem.name) || 
            (newItem.hsnCode && newItem.hsnCode !== existingItem.hsnCode)) {
           itemChanged = true;
        }

        if (itemChanged) result.updated++;

        const finalQuantity = newItem.quantity !== undefined ? newItem.quantity : existingItem.quantity;
        
        // RULE UPDATE: Any item listed in a sheet automatically unarchives
        upsertPayload.push({
          part_number: cleanPN, 
          name: newItem.name || existingItem.name,
          brand: newItem.brand || existingItem.brand,
          hsn_code: newItem.hsnCode || existingItem.hsnCode,
          quantity: finalQuantity,
          min_stock_threshold: newItem.minStockThreshold !== undefined ? newItem.minStockThreshold : existingItem.minStockThreshold,
          price: newItem.price !== undefined ? newItem.price : existingItem.price,
          last_updated: new Date().toISOString(),
          is_archived: false // Force unarchive
        });

      } else {
        result.added++;
        let detectedBrand = Brand.UNKNOWN;
        if (cleanPN.startsWith('HY')) detectedBrand = Brand.HYUNDAI;
        else if (cleanPN.startsWith('MH')) detectedBrand = Brand.MAHINDRA;

        upsertPayload.push({
          part_number: cleanPN,
          name: newItem.name || 'AI Added Part',
          brand: (newItem.brand || detectedBrand) as string,
          hsn_code: newItem.hsnCode || 'N/A',
          quantity: newItem.quantity !== undefined ? newItem.quantity : 0,
          min_stock_threshold: newItem.minStockThreshold !== undefined ? newItem.minStockThreshold : 3,
          price: newItem.price !== undefined ? newItem.price : 0,
          last_updated: new Date().toISOString(),
          is_archived: false
        });
      }
    });

    const UPLOAD_BATCH_SIZE = 500;
    for (let i = 0; i < upsertPayload.length; i += UPLOAD_BATCH_SIZE) {
      const batch = upsertPayload.slice(i, i + UPLOAD_BATCH_SIZE);
      const { error } = await supabase.from('inventory').upsert(batch, { onConflict: 'part_number' });
      if (error) result.errors.push(`Database Error: ${error.message}`);
    }

    if (priceHistoryPayload.length > 0) {
      await supabase.from('price_history').insert(priceHistoryPayload);
    }
    return result;
  }

  const currentInventory = getFromLS();
  newItems.forEach((newItem, index) => {
    if (!newItem.partNumber) return;
    const cleanPN = newItem.partNumber.toUpperCase().trim();
    const existingIndex = currentInventory.findIndex(i => i.partNumber.toUpperCase() === cleanPN);

    if (existingIndex > -1) {
      const existing = currentInventory[existingIndex];
      const finalQuantity = newItem.quantity !== undefined ? Number(newItem.quantity) : existing.quantity;
      currentInventory[existingIndex] = {
        ...existing,
        ...newItem,
        partNumber: cleanPN,
        quantity: finalQuantity,
        lastUpdated: new Date().toISOString(),
        isArchived: false // Force unarchive locally
      };
      result.updated++;
    } else {
      currentInventory.push({
        id: crypto.randomUUID(),
        partNumber: cleanPN,
        name: newItem.name || 'Unknown Part',
        brand: (newItem.brand || Brand.UNKNOWN) as Brand,
        hsnCode: newItem.hsnCode || 'N/A',
        quantity: newItem.quantity !== undefined ? Number(newItem.quantity) : 0,
        minStockThreshold: newItem.minStockThreshold !== undefined ? Number(newItem.minStockThreshold) : 3,
        price: newItem.price !== undefined ? Number(newItem.price) : 0,
        lastUpdated: new Date().toISOString(),
        isArchived: false
      });
      result.added++;
    }
  });

  await saveInventory(currentInventory);
  return result;
};

export const fetchUploadHistory = async (): Promise<UploadHistoryEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('upload_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) return [];
  return data.map(row => ({
    id: row.id,
    fileName: row.file_name,
    uploadMode: row.upload_mode,
    itemCount: row.item_count,
    status: row.status,
    snapshotData: row.snapshot_data,
    createdAt: row.created_at
  }));
};

export const revertUploadBatch = async (historyId: string): Promise<{ success: boolean, message: string }> => {
  if (!supabase) return { success: false, message: "Backend not connected" };

  const { data: history, error } = await supabase.from('upload_history').select('*').eq('id', historyId).single();
  if (error || !history) return { success: false, message: "History record not found" };
  if (history.status === 'REVERTED') return { success: false, message: "Already reverted" };

  const snapshot = history.snapshot_data as Array<{ part_number: string, previous_state: DBItem | null }>;
  if (!snapshot) return { success: false, message: "No snapshot data available" };

  const toDelete = snapshot.filter(s => s.previous_state === null).map(s => s.part_number);
  const toRestore = snapshot.filter(s => s.previous_state !== null).map(s => s.previous_state as DBItem);

  try {
    if (toDelete.length > 0) {
      await supabase.from('inventory').delete().in('part_number', toDelete);
    }
    if (toRestore.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toRestore.length; i += BATCH_SIZE) {
        await supabase.from('inventory').upsert(toRestore.slice(i, i + BATCH_SIZE), { onConflict: 'part_number' });
      }
    }
    await supabase.from('upload_history').update({ status: 'REVERTED' }).eq('id', historyId);
    return { success: true, message: "Batch reverted successfully." };
  } catch (err: any) {
    return { success: false, message: `Revert failed: ${err.message}` };
  }
};

export const fetchPriceHistory = async (partNumber: string): Promise<PriceHistoryEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('part_number', partNumber.toUpperCase().trim())
    .order('change_date', { ascending: false });

  if (error) return [];
  return data.map((d: any) => ({
    id: d.id,
    partNumber: d.part_number,
    oldPrice: d.old_price,
    newPrice: d.new_price,
    changeDate: d.change_date
  }));
};
