import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const g = globalThis as unknown as { __sb?: SupabaseClient };
const AUTH_STORAGE_KEY = 'poster-admin-auth';

function readEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return { url, anon };
}

function createSb(): SupabaseClient {
  const { url, anon } = readEnv();
  if (!url.startsWith('https://') || !anon) {
    throw new Error('未設定 Supabase URL 或 KEY');
  }
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
      detectSessionInUrl: false, // 因為我們手動 exchangeCodeForSession()
    },
  });
}

export function getSupabase(): SupabaseClient {
  if (!g.__sb) g.__sb = createSb();
  return g.__sb;
}
