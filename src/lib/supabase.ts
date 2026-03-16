import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your_supabase_project_url') &&
  !supabaseKey.includes('your_supabase_anon_key'),
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://demo-project.supabase.co',
  isSupabaseConfigured ? supabaseKey! : 'demo-anon-key',
);
