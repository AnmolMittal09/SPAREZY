
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
  RETURN = 'RETURN', // Customer returned item
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
  relatedTransactionId?: string; // ID of the original transaction (e.g., the Sale being returned)
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

export interface PriceHistoryEntry {
  id: string;
  partNumber: string;
  oldPrice: number;
  newPrice: number;
  changeDate: string;
}

export enum RequestStatus {
  PENDING = 'PENDING',
  ORDERED = 'ORDERED',
  REJECTED = 'REJECTED',
}

export interface StockRequest {
  id: string;
  partNumber: string;
  quantityNeeded: number;
  requesterName: string;
  status: RequestStatus;
  createdAt: string;
}
