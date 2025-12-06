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
 *   last_updated timestamptz default now()
 * );
 */