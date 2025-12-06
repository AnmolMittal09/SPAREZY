
import { INITIAL_STOCK_DATA } from '../constants';
import { Brand, StockItem, StockStats } from '../types';
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

export const saveInventory = async (items: StockItem[]): Promise<void> => {
  if (supabase) {
     // NOTE: We generally shouldn't overwrite the whole DB with a client-side array 
     // in a real backend scenario, but for compatibility with the existing LS logic:
     // We will skip this implementation because we now use updateOrAddItems for mutations.
     return;
  }
  
  await delay(300);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getStats = (items: StockItem[]): StockStats => {
  return {
    totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
    totalValue: items.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0),
    lowStockCount: items.filter(i => i.quantity > 0 && i.quantity < i.minStockThreshold).length,
    zeroStockCount: items.filter(i => i.quantity === 0).length,
  };
};

export interface UpdateResult {
  added: number;
  updated: number;
  priceUpdates: number;
  stockUpdates: number;
  errors: string[];
}

export const updateOrAddItems = async (newItems: Partial<StockItem>[]): Promise<UpdateResult> => {
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

    // 2. Fetch existing items in batches (Supabase 'in' filter has limits)
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

    // 3. Prepare Upsert Payload & Calculate Stats
    const upsertPayload: Partial<DBItem>[] = [];

    newItems.forEach((newItem, index) => {
      if (!newItem.partNumber) {
        result.errors.push(`Row ${index + 1}: Missing Part Number`);
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
        }
        // Check other fields
        if ((newItem.name && newItem.name !== existingItem.name) || 
            (newItem.hsnCode && newItem.hsnCode !== existingItem.hsnCode)) {
           itemChanged = true;
        }

        if (itemChanged) result.updated++;

        // Construct Merged Object for DB
        // We only send fields that are defined. Supabase handles partial updates via Upsert if configured correctly,
        // but explicit merging ensures we don't accidentally NULL something if we send a partial object.
        upsertPayload.push({
          part_number: newItem.partNumber, // Key
          // If newItem has value, use it. Else use existing.
          name: newItem.name !== undefined ? newItem.name : existingItem.name,
          brand: newItem.brand !== undefined ? newItem.brand : existingItem.brand,
          hsn_code: newItem.hsnCode !== undefined ? newItem.hsnCode : existingItem.hsnCode,
          quantity: newItem.quantity !== undefined ? newItem.quantity : existingItem.quantity,
          min_stock_threshold: newItem.minStockThreshold !== undefined ? newItem.minStockThreshold : existingItem.minStockThreshold,
          price: newItem.price !== undefined ? newItem.price : existingItem.price,
          last_updated: new Date().toISOString()
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
          last_updated: new Date().toISOString()
        });
      }
    });

    // 4. Batch Push to Supabase
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

      currentInventory[existingIndex] = {
        ...existingItem,
        ...newItem,
        quantity: quantityInput !== undefined ? quantityInput : existingItem.quantity,
        price: priceInput !== undefined ? priceInput : existingItem.price,
        minStockThreshold: thresholdInput !== undefined ? thresholdInput : existingItem.minStockThreshold,
        brand: newItem.brand ? newItem.brand : existingItem.brand,
        lastUpdated: new Date().toISOString(),
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
      });
      result.added++;
    }
  });

  await saveInventory(currentInventory);
  return result;
};
