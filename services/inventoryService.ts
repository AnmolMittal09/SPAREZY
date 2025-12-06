import { INITIAL_STOCK_DATA } from '../constants';
import { Brand, StockItem, StockStats } from '../types';

const STORAGE_KEY = 'sparezy_inventory_v1';

export const getInventory = (): StockItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STOCK_DATA));
    return INITIAL_STOCK_DATA;
  }
  return JSON.parse(stored);
};

export const saveInventory = (items: StockItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getStats = (items: StockItem[]): StockStats => {
  return {
    totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
    totalValue: items.reduce((acc, item) => acc + (item.quantity * item.price), 0),
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

export const updateOrAddItems = (newItems: Partial<StockItem>[]): UpdateResult => {
  const currentInventory = getInventory();
  let added = 0;
  let updated = 0;
  let priceUpdates = 0;
  let stockUpdates = 0;
  const errors: string[] = [];

  newItems.forEach((newItem, index) => {
    if (!newItem.partNumber) {
      errors.push(`Row ${index + 1}: Missing Part Number`);
      return;
    }

    const existingIndex = currentInventory.findIndex(
      (i) => i.partNumber.toLowerCase() === newItem.partNumber?.toLowerCase()
    );

    // Helper to safely parse numbers only if they are provided
    const parseNumber = (val: any) => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : undefined;

    const quantityInput = parseNumber(newItem.quantity);
    const priceInput = parseNumber(newItem.price);
    const thresholdInput = parseNumber(newItem.minStockThreshold);

    if (existingIndex > -1) {
      // Update Existing Item
      const existingItem = currentInventory[existingIndex];
      let itemChanged = false;
      
      // Track specific updates
      if (quantityInput !== undefined && quantityInput !== existingItem.quantity) {
        stockUpdates++;
        itemChanged = true;
      }
      if (priceInput !== undefined && priceInput !== existingItem.price) {
        priceUpdates++;
        itemChanged = true;
      }
      if (newItem.name && newItem.name !== existingItem.name) itemChanged = true;
      if (newItem.hsnCode && newItem.hsnCode !== existingItem.hsnCode) itemChanged = true;

      currentInventory[existingIndex] = {
        ...existingItem,
        ...newItem, // Spread string fields like name, hsnCode if present
        // Only update numeric fields if they exist in the input, otherwise keep existing
        quantity: quantityInput !== undefined ? quantityInput : existingItem.quantity,
        price: priceInput !== undefined ? priceInput : existingItem.price,
        minStockThreshold: thresholdInput !== undefined ? thresholdInput : existingItem.minStockThreshold,
        // Ensure brand is updated if provided, else keep existing
        brand: newItem.brand ? newItem.brand : existingItem.brand,
        lastUpdated: new Date().toISOString(),
      };
      
      if (itemChanged) updated++;
    } else {
      // Add New Item
      if (!newItem.name && !newItem.brand) {
         // Minimal check for new items
         errors.push(`Row ${index + 1} (${newItem.partNumber}): New item skipped (missing Name/Brand)`);
         return;
      }

      currentInventory.push({
        id: crypto.randomUUID(),
        partNumber: newItem.partNumber,
        name: newItem.name || 'Unknown Part',
        brand: newItem.brand as Brand,
        hsnCode: newItem.hsnCode || 'N/A',
        quantity: quantityInput !== undefined ? quantityInput : 0, // Default to 0 for new items
        minStockThreshold: thresholdInput !== undefined ? thresholdInput : 5,
        price: priceInput !== undefined ? priceInput : 0,
        lastUpdated: new Date().toISOString(),
      });
      added++;
    }
  });

  saveInventory(currentInventory);
  return { added, updated, priceUpdates, stockUpdates, errors };
};