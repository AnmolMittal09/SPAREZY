
import { Customer, ShopSettings, Supplier } from '../types';

// Mock Data Store
let customers: Customer[] = [
  { id: '1', name: 'Walk-in Customer', phone: '', type: 'RETAIL' },
  { id: '2', name: 'City Garage', phone: '9876543210', type: 'GARAGE', gst: '29ABCDE1234F1Z5' }
];

let suppliers: Supplier[] = [
  { id: '1', name: 'Metro Spares Ltd', contactPerson: 'Rahul', phone: '9988776655', gst: '29XXXYY1234' },
  { id: '2', name: 'Global Auto Parts', contactPerson: 'Simran', phone: '8877665544' }
];

let shopSettings: ShopSettings = {
  name: 'Sparezy Auto Parts',
  address: '123, Auto Market, Main Road, New Delhi',
  phone: '+91 98765 43210',
  gst: '07AAACS1234A1Z1',
  defaultTaxRate: 18
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- CUSTOMERS ---
export const getCustomers = async (): Promise<Customer[]> => {
  await delay(200);
  return [...customers];
};

export const saveCustomer = async (customer: Customer): Promise<void> => {
  await delay(200);
  if (customer.id) {
    customers = customers.map(c => c.id === customer.id ? customer : c);
  } else {
    customers.push({ ...customer, id: Math.random().toString(36).substr(2, 9) });
  }
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await delay(200);
  customers = customers.filter(c => c.id !== id);
};

// --- SUPPLIERS ---
export const getSuppliers = async (): Promise<Supplier[]> => {
  await delay(200);
  return [...suppliers];
};

export const saveSupplier = async (supplier: Supplier): Promise<void> => {
  await delay(200);
  if (supplier.id) {
    suppliers = suppliers.map(s => s.id === supplier.id ? supplier : s);
  } else {
    suppliers.push({ ...supplier, id: Math.random().toString(36).substr(2, 9) });
  }
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await delay(200);
  suppliers = suppliers.filter(s => s.id !== id);
};

// --- SHOP SETTINGS ---
export const getShopSettings = async (): Promise<ShopSettings> => {
  await delay(100);
  return { ...shopSettings };
};

export const saveShopSettings = async (settings: ShopSettings): Promise<void> => {
  await delay(200);
  shopSettings = settings;
};
