// lib/supabaseClient.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseBrowser } from "./supabaseBrowser";

export type AppRole = "studio" | "poster";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const cookieName = {
  studio: { name: "sb-studio", at: "sb-studio-at", rt: "sb-studio-rt" },
  poster: { name: "sb-poster", at: "sb-poster-at", rt: "sb-poster-rt" },
} as const;

const base: CookieOptions = { path: "/", httpOnly: true, sameSite: "lax", secure: true };

/** Next 15 相容：用函式簽章把 cookies 交給 @supabase/ssr 管 */
export async function getSupabaseServer(role: AppRole) {
  // next/headers 只能在 server context 使用；為避免在模組載入時引用造成 client build 錯誤，
  // 在函式內動態 import 並回傳一個取得 cookies 的函式。
  const getStore = async () => {
    const mod = await import("next/headers");
    return mod.cookies();
  };

  return createServerClient(url, anon, {
    // 這裡可以設定 cookie 前綴名稱（新版型別允許）
    cookieOptions: { name: cookieName[role].name, ...base },
    // types: Supabase's typings expect a different cookies shape; cast to any to satisfy TS for now
    cookies: getStore as any, // ✅ 新版簽章：() => Promise<ReadonlyRequestCookies>
  });
}

/** 產生各自的 OAuth callback URL */
export function getOAuthCallback(role: AppRole, origin: string) {
  const path = role === "studio" ? "/studio/auth/callback" : "/edit/auth/callback";
  return `${origin}${path}`;
}

/**
 * 兼容舊代碼：在 client-side 提供 getSupabase() 工廠，回傳預設 role 的 browser client
 * 其它檔案習慣直接 import { getSupabase } from './supabaseClient'
 */
export function getSupabase() {
  // 預設回傳 studio 的 browser client；若需要 poster，可直接呼叫 getSupabaseBrowser("poster")
  return getSupabaseBrowser("studio");
}
