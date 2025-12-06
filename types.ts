export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
}

export enum Brand {
  HYUNDAI = 'HYUNDAI',
  MAHINDRA = 'MAHINDRA',
  UNKNOWN = 'UNKNOWN',
}

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
}

export interface StockItem {
  id: string;
  partNumber: string;
  name: string;
  brand: Brand;
  hsnCode: string;
  quantity: number;
  minStockThreshold: number;
  price: number;
  lastUpdated: string;
}

export interface StockStats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  zeroStockCount: number;
}

// Database Schema Representation (Mock)
// Table: Users { id (PK), username, role, name, password_hash }
// Table: Inventory { id (PK), part_number (Unique), name, brand, hsn_code, quantity, threshold, price, last_updated }