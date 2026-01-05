
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
 * --- 🚨 UPDATE FOR PARTIAL PAYMENTS 🚨 ---
 * ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
 * ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
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
 *   paid_amount numeric default 0,
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
 *   part_number text not null, 
 *   type text not null, 
 *   quantity int not null,
 *   price numeric,
 *   paid_amount numeric default 0,
 *   customer_name text,
 *   status text default 'PENDING',
 *   payment_status text default 'PAID',
 *   created_by_role text,
 *   created_at timestamptz default now(),
 *   related_transaction_id uuid,
 *   invoice_id uuid references invoices(id)
 * );
 */
