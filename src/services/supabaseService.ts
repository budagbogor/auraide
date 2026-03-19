import { createClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let supabaseClient: any = null;

export const getSupabaseClient = (config?: SupabaseConfig) => {
  if (config) {
    supabaseClient = createClient(config.url, config.anonKey);
  }
  return supabaseClient;
};

export const testSupabaseConnection = async (config: SupabaseConfig) => {
  const client = createClient(config.url, config.anonKey);
  const { data, error } = await client.from('_health').select('*').limit(1); // Generic health check attempt
  if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
    // PGRST116 is "no rows", 42P01 is "table does not exist" - both mean we connected but table is missing
    throw error;
  }
  return true;
};
