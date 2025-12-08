

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
  isArchived: boolean;
  rackLocation?: string;
  vehicleModels?: string[];
  category?: string;
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
  RETURN = 'RETURN', 
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  ADJUSTMENT = 'ADJUSTMENT'
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
  customerName: string; 
  status: TransactionStatus;
  createdByRole: Role;
  createdAt: string;
  relatedTransactionId?: string;
  invoiceId?: string; // New: Links transaction to a formal tax invoice
}

export interface UploadHistoryEntry {
  id: string;
  fileName: string;
  uploadMode: string;
  itemCount: number;
  status: 'SUCCESS' | 'REVERTED';
  snapshotData: any;
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
  COMPLETED = 'COMPLETED'
}

export interface StockRequest {
  id: string;
  partNumber: string;
  quantityNeeded: number;
  requesterName: string;
  status: RequestStatus;
  createdAt: string;
  notes?: string;
}

// --- NEW TYPES FOR UPGRADE ---

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: 'RETAIL' | 'GARAGE';
  gst?: string;
  address?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  gst?: string;
  terms?: string;
}

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  gst: string;
  defaultTaxRate: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g., INV-2023-001
  date: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGst?: string;
  totalAmount: number;
  taxAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT';
  itemsCount: number;
  generatedBy: string;
}
