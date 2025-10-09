// /lib/templateApi.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

// 兼容 NEXT_PUBLIC_ 與 VITE_（避免讀不到）
function readBASE() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  );
}
const BASE = readBASE(); // e.g. https://xxx.supabase.co

function requireSb(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase 未初始化：請確認 .env.local 內已設定 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY（或 VITE_ 對應），並已重啟 dev。"
    );
  }
  return sb;
}

export type TextLayer = {
  label: string;
  text?: string;
  x?: number; y?: number; width?: number;
  fontSize?: number; color?: string;
  weight?: number; align?: 'left'|'center'|'right';
  uppercase?: boolean; italic?: boolean; shadow?: boolean;
  order?: number;
};

export type Template = {
  id: string; slug: string; name: string;
  width: number; height: number;
  bg_url: string; logo_url?: string | null;
  created_at: string; updated_at: string;
  text_layer: TextLayer[];
};

/** B 端 — 讀清單（支援關鍵字） */
export async function listTemplates(q = "", limit = 20, offset = 0) {
  const supabase = requireSb();
  let query = supabase
    .from("template")
    .select("*, text_layer(*)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Template[];
}

/** B 端 — 讀單一（支援 slug 或 id） */
export async function getTemplate(idOrSlug: string) {
  const supabase = requireSb();
  const { data, error } = await supabase
    .from("template")
    .select("*, text_layer(*)")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .single();
  if (error) throw error;
  return data as Template;
}

/**
 * A 端 — 上傳素材
 * 方式1：呼叫你的 Edge Function 取得簽名 URL，接著 PUT 上傳
 * 備援：若 BASE 沒讀到，直接用 Storage SDK 上傳到 'assets' bucket（檔名自動加 UUID）
 */
export async function uploadAsset(file: File) {
  // 首選：Edge Function 簽名上傳（需 BASE）
  if (BASE) {
    const res = await fetch(`${BASE}/functions/v1/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { signedUrl, path } = await res.json();
    const put = await fetch(signedUrl, { method: "PUT", body: file });
    if (!put.ok) throw new Error("upload failed");
    const publicUrl = `${BASE}/storage/v1/object/public/assets/${path}`;
    return { path, publicUrl };
  }

  // 備援：用 Storage SDK 上傳
  const supabase = requireSb();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/** A 端 — 建立或更新模板（PUT 時以 ?id=slug 或 id 指定） */
export async function upsertTemplate(payload: any, idOrSlug?: string) {
  if (!BASE) {
    throw new Error(
      "缺少 BASE（NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL），無法呼叫 Edge Function /functions/v1/templates。"
    );
  }
  const url = new URL(`${BASE}/functions/v1/templates`);
  if (idOrSlug) url.searchParams.set("id", idOrSlug);
  const res = await fetch(url.toString(), {
    method: idOrSlug ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
