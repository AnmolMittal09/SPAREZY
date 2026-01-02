import { createClient } from '@supabase/supabase-js';

// Access environment variables safely
// @ts-ignore
const getEnv = (key: string) => (import.meta.env && import.meta.env[key]) || '';

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

/**
 * ==========================================
 * SUPABASE SQL COMMANDS (Run in SQL Editor)
 * ==========================================
 * 
 * --- 🚨 IMPORTANT FIX FOR INVOICE ERROR 🚨 ---
 * Run this command to fix the "violates check constraint" error:
 * 
 * ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_mode_check;
 * ALTER TABLE invoices ADD CONSTRAINT invoices_payment_mode_check 
 * CHECK (payment_mode IN ('CASH', 'UPI', 'CARD', 'CREDIT'));
 * 
 * ---------------------------------------------
 * 
 * -- 1. Enable UUID Extension
 * create extension if not exists "uuid-ossp";
 * 
 * -- 2. App Users (Role Based Access)
 * create table if not exists app_users (
 *   id uuid default uuid_generate_v4() primary key,
 *   username text unique not null,
 *   password text not null,
 *   name text not null,
 *   role text not null check (role in ('OWNER', 'MANAGER')),
 *   created_at timestamptz default now()
 * );
 * 
 * -- 3. Inventory Table
 * create table if not exists inventory (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text unique not null,
 *   name text,
 *   brand text,
 *   hsn_code text,
 *   quantity int default 0,
 *   min_stock_threshold int default 3,
 *   price numeric default 0,
 *   last_updated timestamptz default now(),
 *   is_archived boolean default false
 * );
 * 
 * -- 4. Customers
 * create table if not exists customers (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text not null,
 *   phone text,
 *   type text check (type in ('RETAIL', 'GARAGE')),
 *   gst text,
 *   address text,
 *   created_at timestamptz default now()
 * );
 * 
 * -- 5. Suppliers
 * create table if not exists suppliers (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text not null,
 *   contact_person text,
 *   phone text,
 *   gst text,
 *   terms text,
 *   created_at timestamptz default now()
 * );
 * 
 * -- 6. Shop Settings
 * create table if not exists shop_settings (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text,
 *   address text,
 *   phone text,
 *   gst text,
 *   default_tax_rate numeric default 18,
 *   updated_at timestamptz default now()
 * );
 * 
 * -- 7. Invoices
 * create table if not exists invoices (
 *   id uuid default uuid_generate_v4() primary key,
 *   invoice_number text unique not null,
 *   date timestamptz default now(),
 *   customer_name text,
 *   customer_phone text,
 *   customer_address text,
 *   customer_gst text,
 *   total_amount numeric,
 *   tax_amount numeric,
 *   payment_mode text check (payment_mode in ('CASH', 'UPI', 'CARD', 'CREDIT')),
 *   items_count int,
 *   generated_by text,
 *   created_at timestamptz default now()
 * );
 * 
 * -- 8. Transactions (Linked to Inventory and Invoices)
 * create table if not exists transactions (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text not null, -- Intentionally text to allow unlinked history, or add references inventory(part_number)
 *   type text not null, -- 'SALE', 'PURCHASE', 'RETURN'
 *   quantity int not null,
 *   price numeric,
 *   customer_name text,
 *   status text default 'PENDING',
 *   created_by_role text,
 *   created_at timestamptz default now(),
 *   related_transaction_id uuid,
 *   invoice_id uuid references invoices(id)
 * );
 * 
 * -- 9. Stock Requests
 * create table if not exists stock_requests (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text not null,
 *   quantity_needed int not null,
 *   requester_name text,
 *   status text default 'PENDING',
 *   created_at timestamptz default now()
 * );
 * 
 * -- 10. Histories
 * create table if not exists price_history (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text not null,
 *   old_price numeric,
 *   new_price numeric,
 *   change_date timestamptz default now()
 * );
 * 
 * create table if not exists upload_history (
 *   id uuid default uuid_generate_v4() primary key,
 *   file_name text,
 *   upload_mode text,
 *   item_count int,
 *   status text default 'SUCCESS',
 *   snapshot_data jsonb,
 *   created_at timestamptz default now()
 * );
 * 
 * -- SEED DEFAULT USER (Optional)
 * insert into app_users (username, password, name, role) 
 * values ('admin', 'admin', 'System Admin', 'OWNER')
 * on conflict do nothing;
 */