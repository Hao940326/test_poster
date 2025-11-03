// /lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;

  // 讀 sb-host（由 middleware 寫入），只為了決定 storageKey（可選）
  let sbHost: string | null = null;
  if (typeof document !== "undefined") {
    sbHost =
      document.cookie
        .split("; ")
        .find((r) => r.startsWith("sb-host="))
        ?.split("=")[1] ?? null;
  }

  const storageKey = sbHost === "poster" ? "sb-poster" : "sb-studio";
  // 註：不同子網域本來 localStorage 就隔離，這行只是更明確避免衝突

  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey, // ✅ 合法欄位；不使用 cookieOptions
      },
    }
  );

  return browserClient;
}
