
import { supabase } from './supabase';
import { Customer, ShopSettings, Supplier } from '../types';

// --- CUSTOMERS ---

export const getCustomers = async (): Promise<Customer[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data as Customer[];
};

export const saveCustomer = async (customer: Customer): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };

  const payload = {
    name: customer.name,
    phone: customer.phone,
    type: customer.type,
    gst: customer.gst,
    address: customer.address
  };

  let error;
  if (customer.id) {
    // Update
    ({ error } = await supabase.from('customers').update(payload).eq('id', customer.id));
  } else {
    // Insert
    ({ error } = await supabase.from('customers').insert(payload));
  }

  if (error) return { success: false, message: error.message };
  return { success: true };
};

export const deleteCustomer = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('customers').delete().eq('id', id);
};

// --- SUPPLIERS ---

export const getSuppliers = async (): Promise<Supplier[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
  
  // Map snake_case DB to camelCase if necessary, but assuming simple mapping
  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    contactPerson: d.contact_person,
    phone: d.phone,
    gst: d.gst,
    terms: d.terms
  }));
};

export const saveSupplier = async (supplier: Supplier): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };

  const payload = {
    name: supplier.name,
    contact_person: supplier.contactPerson,
    phone: supplier.phone,
    gst: supplier.gst,
    terms: supplier.terms
  };

  let error;
  if (supplier.id) {
    ({ error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id));
  } else {
    ({ error } = await supabase.from('suppliers').insert(payload));
  }

  if (error) return { success: false, message: error.message };
  return { success: true };
};

export const deleteSupplier = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('suppliers').delete().eq('id', id);
};

// --- SHOP SETTINGS ---

export const getShopSettings = async (): Promise<ShopSettings> => {
  if (!supabase) return {
    name: 'Sparezy Auto Parts',
    address: 'Demo Address',
    phone: '9876543210',
    gst: '',
    defaultTaxRate: 18
  };

  const { data, error } = await supabase.from('shop_settings').select('*').single();
  
  if (error || !data) {
    // Return defaults if no settings found
    return {
      name: 'Sparezy Auto Parts',
      address: '',
      phone: '',
      gst: '',
      defaultTaxRate: 18
    };
  }

  return {
    name: data.name,
    address: data.address,
    phone: data.phone,
    gst: data.gst,
    defaultTaxRate: data.default_tax_rate
  };
};

export const saveShopSettings = async (settings: ShopSettings): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };

  // Check if row exists, if not insert, else update
  const { data: existing } = await supabase.from('shop_settings').select('id').limit(1);

  const payload = {
    name: settings.name,
    address: settings.address,
    phone: settings.phone,
    gst: settings.gst,
    default_tax_rate: settings.defaultTaxRate,
    updated_at: new Date().toISOString()
  };

  let error;
  if (existing && existing.length > 0) {
    ({ error } = await supabase.from('shop_settings').update(payload).eq('id', existing[0].id));
  } else {
    ({ error } = await supabase.from('shop_settings').insert(payload));
  }

  if (error) return { success: false, message: error.message };
  return { success: true };
};
