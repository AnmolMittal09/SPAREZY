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

export enum TransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface Transaction {
  id: string;
  partNumber: string;
  type: TransactionType;
  quantity: number;
  price: number;
  customerName: string; // Customer or Supplier Name
  status: TransactionStatus;
  createdByRole: Role;
  createdAt: string;
}

export interface UploadHistoryEntry {
  id: string;
  fileName: string;
  uploadMode: string;
  itemCount: number;
  status: 'SUCCESS' | 'REVERTED';
  snapshotData: any; // JSON structure containing previous states
  createdAt: string;
}

// Database Schema Representation (Mock)
// Table: Users { id (PK), username, role, name, password_hash }
// Table: Inventory { id (PK), part_number (Unique), name, brand, hsn_code, quantity, threshold, price, last_updated }
// Table: Transactions { id (PK), part_number, type, quantity, price, customer_name, status, created_by_role, created_at }
// Table: UploadHistory { id (PK), file_name, upload_mode, item_count, status, snapshot_data, created_at }
