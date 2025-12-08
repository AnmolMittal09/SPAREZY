
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
  partNumber: dbItem.part_number,
  name: dbItem.name,
  brand: dbItem.brand as Brand,
  hsnCode: dbItem.hsn_code,
  quantity: dbItem.quantity,
  minStockThreshold: dbItem.min_stock_threshold,
  price: dbItem.price,
  lastUpdated: dbItem.last_updated,
  isArchived: dbItem.is_archived || false,
});

const toDBItem = (item: Partial<StockItem>): Partial<DBItem> => {
  const dbItem: Partial<DBItem> = {};
  if (item.partNumber) dbItem.part_number = item.partNumber;
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

    // Loop to fetch all pages
    while (hasMore) {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order('part_number', { ascending: true });
      
      if (error) {
        console.error('Supabase fetch error:', error);
        break; // Stop fetching on error
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as DBItem[]);
        // If we got fewer items than requested, we've reached the end
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

  // Fallback to LocalStorage
  await delay(300); 
  return getFromLS();
};

export const fetchItemDetails = async (partNumber: string): Promise<StockItem | null> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .ilike('part_number', partNumber)
      .single();
    
    if (error || !data) return null;
    return toAppItem(data);
  }
  const items = getFromLS();
  return items.find(i => i.partNumber.toLowerCase() === partNumber.toLowerCase()) || null;
};

export const toggleArchiveStatus = async (partNumber: string, isArchived: boolean): Promise<void> => {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('inventory')
    .update({ is_archived: isArchived })
    .ilike('part_number', partNumber); // Case insensitive match

  if (error) throw new Error(error.message);
};

export const bulkArchiveItems = async (partNumbers: string[], isArchived: boolean): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('inventory')
    .update({ is_archived: isArchived })
    .in('part_number', partNumbers);

  if (error) throw new Error(error.message);
};

export const saveInventory = async (items: StockItem[]): Promise<void> => {
  if (supabase) {
     return;
  }
  await delay(300);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getStats = (items: StockItem[]): StockStats => {
  // Only count non-archived items for stats
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
  const result: UpdateResult = {
    added: 0,
    updated: 0,
    priceUpdates: 0,
    stockUpdates: 0,
    errors: []
  };

  // --- SUPABASE LOGIC ---
  if (supabase) {
    // 1. Extract Part Numbers from upload to fetch relevant existing data
    const partNumbers = newItems
      .map(i => i.partNumber)
      .filter((pn): pn is string => !!pn);

    if (partNumbers.length === 0) {
      result.errors.push("No valid part numbers found.");
      return result;
    }

    // 2. Fetch existing items in batches
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
          existingItemsMap.set(item.partNumber.toLowerCase(), item);
        });
      }
    }

    // --- SNAPSHOT LOGIC FOR UNDO ---
    if (metadata) {
      const snapshot = newItems.map(newItem => {
        if (!newItem.partNumber) return null;
        const key = newItem.partNumber.toLowerCase();
        const existing = existingItemsMap.get(key);
        return {
          part_number: newItem.partNumber,
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

      if (histError) console.error("Failed to save upload history:", histError);
    }

    // 3. Prepare Upsert Payload & Calculate Stats & Track Price History
    const upsertPayload: Partial<DBItem>[] = [];
    const priceHistoryPayload: any[] = [];

    newItems.forEach((newItem, index) => {
      if (!newItem.partNumber) {
        result.errors.push(`Row ${index + 1}: Missing Part Number`);
        return;
      }
      
      // Integer Overflow Check
      if (newItem.quantity !== undefined && (newItem.quantity > 1000000 || newItem.quantity < -1000000)) {
        result.errors.push(`Row ${index + 1}: Skipped due to invalid quantity value (${newItem.quantity}). Check parsing.`);
        return;
      }

      const existingItem = existingItemsMap.get(newItem.partNumber.toLowerCase());
      
      // Merge logic for stats
      if (existingItem) {
        let itemChanged = false;
        if (newItem.quantity !== undefined && newItem.quantity !== existingItem.quantity) {
          result.stockUpdates++;
          itemChanged = true;
        }
        if (newItem.price !== undefined && newItem.price !== existingItem.price) {
          result.priceUpdates++;
          itemChanged = true;
          // Log Price History
          priceHistoryPayload.push({
            part_number: existingItem.partNumber, // Use original case
            old_price: existingItem.price,
            new_price: newItem.price,
            change_date: new Date().toISOString()
          });
        }
        // Check other fields
        if ((newItem.name && newItem.name !== existingItem.name) || 
            (newItem.hsnCode && newItem.hsnCode !== existingItem.hsnCode)) {
           itemChanged = true;
        }

        if (itemChanged) result.updated++;

        // Logic: If new stock is added (quantity > 0), ensure item is not archived
        const finalQuantity = newItem.quantity !== undefined ? newItem.quantity : existingItem.quantity;
        const shouldUnarchive = existingItem.isArchived && finalQuantity > 0;

        upsertPayload.push({
          part_number: newItem.partNumber, 
          name: newItem.name !== undefined ? newItem.name : existingItem.name,
          brand: newItem.brand !== undefined ? newItem.brand : existingItem.brand,
          hsn_code: newItem.hsnCode !== undefined ? newItem.hsnCode : existingItem.hsnCode,
          quantity: finalQuantity,
          min_stock_threshold: newItem.minStockThreshold !== undefined ? newItem.minStockThreshold : existingItem.minStockThreshold,
          price: newItem.price !== undefined ? newItem.price : existingItem.price,
          last_updated: new Date().toISOString(),
          is_archived: shouldUnarchive ? false : existingItem.isArchived
        });

      } else {
        // New Item
        result.added++;
        
        upsertPayload.push({
          part_number: newItem.partNumber,
          name: newItem.name || 'Unknown Part',
          brand: (newItem.brand || Brand.UNKNOWN) as string,
          hsn_code: newItem.hsnCode || 'N/A',
          quantity: newItem.quantity !== undefined ? newItem.quantity : 0,
          min_stock_threshold: newItem.minStockThreshold !== undefined ? newItem.minStockThreshold : 5,
          price: newItem.price !== undefined ? newItem.price : 0,
          last_updated: new Date().toISOString(),
          is_archived: false // New items default to active
        });
      }
    });

    // 4. Batch Push Inventory Updates
    const UPLOAD_BATCH_SIZE = 500;
    for (let i = 0; i < upsertPayload.length; i += UPLOAD_BATCH_SIZE) {
      const batch = upsertPayload.slice(i, i + UPLOAD_BATCH_SIZE);
      const { error } = await supabase
        .from('inventory')
        .upsert(batch, { onConflict: 'part_number' });
      
      if (error) {
        console.error("Batch upsert error:", error);
        result.errors.push(`Database Error: ${error.message}`);
      }
    }

    // 5. Batch Push Price History
    if (priceHistoryPayload.length > 0) {
      const { error: phError } = await supabase.from('price_history').insert(priceHistoryPayload);
      if (phError) console.error("Failed to log price history", phError);
    }

    return result;
  }

  // --- LOCAL STORAGE FALLBACK (Original Logic) ---
  const currentInventory = getFromLS();

  newItems.forEach((newItem, index) => {
    if (!newItem.partNumber) {
      result.errors.push(`Row ${index + 1}: Missing Part Number`);
      return;
    }

    const existingIndex = currentInventory.findIndex(
      (i) => i.partNumber.toLowerCase() === newItem.partNumber?.toLowerCase()
    );

    const parseNumber = (val: any) => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : undefined;
    const quantityInput = parseNumber(newItem.quantity);
    const priceInput = parseNumber(newItem.price);
    const thresholdInput = parseNumber(newItem.minStockThreshold);

    if (existingIndex > -1) {
      const existingItem = currentInventory[existingIndex];
      let itemChanged = false;
      
      if (quantityInput !== undefined && quantityInput !== existingItem.quantity) {
        result.stockUpdates++;
        itemChanged = true;
      }
      if (priceInput !== undefined && priceInput !== existingItem.price) {
        result.priceUpdates++;
        itemChanged = true;
      }
      if (newItem.name && newItem.name !== existingItem.name) itemChanged = true;
      if (newItem.hsnCode && newItem.hsnCode !== existingItem.hsnCode) itemChanged = true;

      // Unarchive if adding stock
      const finalQuantity = quantityInput !== undefined ? quantityInput : existingItem.quantity;
      const shouldUnarchive = existingItem.isArchived && finalQuantity > 0;

      currentInventory[existingIndex] = {
        ...existingItem,
        ...newItem,
        quantity: finalQuantity,
        price: priceInput !== undefined ? priceInput : existingItem.price,
        minStockThreshold: thresholdInput !== undefined ? thresholdInput : existingItem.minStockThreshold,
        brand: newItem.brand ? newItem.brand : existingItem.brand,
        lastUpdated: new Date().toISOString(),
        isArchived: shouldUnarchive ? false : existingItem.isArchived
      };
      
      if (itemChanged) result.updated++;
    } else {
      currentInventory.push({
        id: crypto.randomUUID(),
        partNumber: newItem.partNumber,
        name: newItem.name || 'Unknown Part',
        brand: newItem.brand as Brand,
        hsnCode: newItem.hsnCode || 'N/A',
        quantity: quantityInput !== undefined ? quantityInput : 0,
        minStockThreshold: thresholdInput !== undefined ? thresholdInput : 5,
        price: priceInput !== undefined ? priceInput : 0,
        lastUpdated: new Date().toISOString(),
        isArchived: false
      });
      result.added++;
    }
  });

  await saveInventory(currentInventory);
  return result;
};

// --- HISTORY FUNCTIONS ---

const mapDBHistoryToApp = (row: any): UploadHistoryEntry => ({
  id: row.id,
  fileName: row.file_name,
  uploadMode: row.upload_mode,
  itemCount: row.item_count,
  status: row.status,
  snapshotData: row.snapshot_data,
  createdAt: row.created_at
});

export const fetchUploadHistory = async (): Promise<UploadHistoryEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('upload_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error("Error fetching history:", error);
    return [];
  }
  return data.map(mapDBHistoryToApp);
};

export const revertUploadBatch = async (historyId: string): Promise<{ success: boolean, message: string }> => {
  if (!supabase) return { success: false, message: "Backend not connected" };

  // 1. Fetch snapshot
  const { data: history, error } = await supabase
    .from('upload_history')
    .select('*')
    .eq('id', historyId)
    .single();

  if (error || !history) return { success: false, message: "History record not found" };
  if (history.status === 'REVERTED') return { success: false, message: "Already reverted" };

  const snapshot = history.snapshot_data as Array<{ part_number: string, previous_state: DBItem | null }>;
  if (!snapshot || snapshot.length === 0) return { success: false, message: "No snapshot data available" };

  // 2. Separate deletes (items that were new) and updates (items that existed)
  const toDelete = snapshot.filter(s => s.previous_state === null).map(s => s.part_number);
  const toRestore = snapshot.filter(s => s.previous_state !== null).map(s => s.previous_state as DBItem);

  try {
    // 3. Perform Revert
    // Delete newly added items
    if (toDelete.length > 0) {
      await supabase.from('inventory').delete().in('part_number', toDelete);
    }
    
    // Restore previous state of modified items
    if (toRestore.length > 0) {
      // Upsert in batches
      const BATCH_SIZE = 500;
      for (let i = 0; i < toRestore.length; i += BATCH_SIZE) {
        const batch = toRestore.slice(i, i + BATCH_SIZE);
        await supabase.from('inventory').upsert(batch, { onConflict: 'part_number' });
      }
    }

    // 4. Mark history as reverted
    await supabase.from('upload_history').update({ status: 'REVERTED' }).eq('id', historyId);

    return { success: true, message: "Batch reverted successfully." };

  } catch (err: any) {
    console.error("Revert failed:", err);
    return { success: false, message: `Revert failed: ${err.message}` };
  }
};

export const fetchPriceHistory = async (partNumber: string): Promise<PriceHistoryEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .ilike('part_number', partNumber)
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
