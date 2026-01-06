
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
 * --- 🚨 EMERGENCY REPAIR SCRIPT 🚨 ---
 * Run this if you see "Could not find column created_by_name":
 * 
 * ALTER TABLE transactions 
 * ADD COLUMN IF NOT EXISTS created_by_name text,
 * ADD COLUMN IF NOT EXISTS created_by_role text,
 * ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
 * ADD COLUMN IF NOT EXISTS related_transaction_id uuid,
 * ADD COLUMN IF NOT EXISTS invoice_id uuid;
 * 
 * -- Enable RLS and create a wide-open policy for testing
 * ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
 * DROP POLICY IF EXISTS "Public Access" ON transactions;
 * CREATE POLICY "Public Access" ON transactions FOR ALL USING (true) WITH CHECK (true);
 * 
 * -- FORCE RELOAD CACHE (CRITICAL)
 * NOTIFY pgrst, 'reload schema';
 * 
 * ---------------------------------------------
 * -- FULL DATABASE DEFINITIONS
 * ---------------------------------------------
 * 
 * -- 1. Extensions
 * create extension if not exists "uuid-ossp";
 * 
 * -- 2. Inventory
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
 * -- 3. Transactions
 * create table if not exists transactions (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text not null,
 *   type text not null, 
 *   quantity int not null,
 *   price numeric default 0,
 *   paid_amount numeric default 0,
 *   customer_name text,
 *   status text default 'PENDING',
 *   created_by_role text,
 *   created_by_name text,
 *   created_at timestamptz default now(),
 *   related_transaction_id uuid,
 *   invoice_id uuid
 * );
 * 
 * -- 4. Price History (Audit Trail)
 * create table if not exists price_history (
 *   id uuid default uuid_generate_v4() primary key,
 *   part_number text not null,
 *   old_price numeric,
 *   new_price numeric,
 *   change_date timestamptz default now()
 * );
 * 
 * -- 5. Upload History (Bulk Update Undo)
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
 * -- 6. App Users
 * create table if not exists app_users (
 *   id uuid default uuid_generate_v4() primary key,
 *   username text unique not null,
 *   password text not null,
 *   name text not null,
 *   role text not null check (role in ('OWNER', 'MANAGER')),
 *   created_at timestamptz default now()
 * );
 * 
 * -- 7. Seed Admin
 * insert into app_users (username, password, name, role) 
 * values ('admin', 'admin', 'Master Admin', 'OWNER')
 * on conflict do nothing;
 */
