// lib/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";

export type AppRole = "studio" | "poster";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const storageKey = {
  studio: "studio-auth",
  poster: "poster-auth",
} as const;

export function getSupabaseBrowser(role: AppRole) {
  return createBrowserClient(url, anon, {
    auth: { storageKey: storageKey[role] }, // 彼此不覆蓋
  });
}
