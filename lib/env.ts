// /lib/env.ts
export function readPublicEnv() {
  // 兼容 NEXT_PUBLIC_ 與你現有的 VITE_ 命名
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  return { url, anon };
}
