// lib/supabaseClient.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseBrowser } from "./supabaseBrowser";

export type AppRole = "studio" | "poster";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 各分區使用不同 cookie 前綴，會話完全隔離 */
const PREFIX = {
  studio: "sb-studio",
  poster: "sb-poster",
} as const;

const BASE_COOKIE: CookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: true,
};

/** ✅ Server 專用：RSC / route handlers 都用這個 */
export async function getSupabaseServer(role: AppRole) {
  // dynamic import to avoid importing `next/headers` at module top-level
  const getStore = async () => {
    const mod = await import("next/headers");
    return mod.cookies();
  };

  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookieOptions: { name: PREFIX[role], ...BASE_COOKIE },
    // cast to any to satisfy Supabase typings for the experimental cookie methods
    cookies: getStore as any,
  });
}

/**
 * Compatibility helper for client-side code that expected `getSupabase()`.
 * Returns a browser client using the default role 'studio'.
 */
export function getSupabase() {
  return getSupabaseBrowser("studio");
}

/** 產生 OAuth callback（避免 undefined / 重複斜線） */
export function getOAuthCallback(role: AppRole, origin: string) {
  const base = (origin || "").replace(/\/+$/, ""); // 去掉結尾斜線
  const path = role === "studio" ? "/studio/auth/callback" : "/edit/auth/callback";
  return `${base}${path}`;
}
