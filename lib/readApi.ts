// /lib/readApi.ts
"use client";

import { getSupabase } from "./supabaseClient";

export async function getTemplate(idOrSlug: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase 未初始化：請確認 .env.local 內已有 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY（或 VITE_ 對應），並已重啟 dev。"
    );
  }

  // 你原本使用的資料表/關聯：template 與 text_layer
  // 保留 .or 查詢 slug 或 id（若 id 是 UUID、slug 是文字也 OK）
  const { data, error } = await supabase
    .from("template")
    .select("*, text_layer(*)")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .single();

  if (error) throw error;
  return data;
}
