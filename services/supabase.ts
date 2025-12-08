
import { createClient } from '@supabase/supabase-js';

// Access environment variables safely for both Vite and Browser Preview
// @ts-ignore
const getEnv = (key: string) => (import.meta.env && import.meta.env[key]) || '';

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Only create the client if keys are present
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

/**
 * SQL SCHEMA FOR SUPABASE:
 * 
 * create table inventory (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text unique not null,
 *   name text,
 *   brand text,
 *   hsn_code text,
 *   quantity int default 0,
 *   min_stock_threshold int default 5,
 *   price numeric default 0,
 *   last_updated timestamptz default now(),
 *   is_archived boolean default false
 * );
 * 
 * create table price_history (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text not null,
 *   old_price numeric,
 *   new_price numeric,
 *   change_date timestamptz default now()
 * );
 * 
 * create table transactions (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text not null,
 *   type text not null, -- 'SALE' or 'PURCHASE'
 *   quantity int not null,
 *   price numeric,
 *   customer_name text,
 *   status text default 'PENDING',
 *   created_by_role text,
 *   created_at timestamptz default now(),
 *   related_transaction_id uuid,
 *   invoice_id uuid -- NEW: Link to invoices table
 * );
 * 
 * create table invoices (
 *   id uuid default gen_random_uuid() primary key,
 *   invoice_number text unique not null,
 *   date timestamptz default now(),
 *   customer_name text,
 *   customer_phone text,
 *   customer_address text,
 *   customer_gst text,
 *   total_amount numeric,
 *   tax_amount numeric,
 *   payment_mode text,
 *   items_count int,
 *   generated_by text
 * );
 * 
 * create table upload_history (
 *   id uuid default gen_random_uuid() primary key,
 *   file_name text,
 *   upload_mode text,
 *   item_count int,
 *   status text default 'SUCCESS',
 *   snapshot_data jsonb,
 *   created_at timestamptz default now()
 * );
 * 
 * create table app_users (
 *   id uuid default gen_random_uuid() primary key,
 *   username text unique not null,
 *   password text not null,
 *   name text not null,
 *   role text not null check (role in ('OWNER', 'MANAGER')),
 *   created_at timestamptz default now()
 * );
 * 
 * create table stock_requests (
 *   id uuid default gen_random_uuid() primary key,
 *   part_number text not null,
 *   quantity_needed int not null,
 *   requester_name text,
 *   status text default 'PENDING',
 *   created_at timestamptz default now()
 * );
 */
