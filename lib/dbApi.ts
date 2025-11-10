"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

/* ===================== 型別 ===================== */
export type TextLayer = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  weight: 300 | 400 | 600 | 800;
  align: "left" | "center" | "right";
  uppercase?: boolean;
  italic?: boolean;
  shadow?: boolean;
};

export type TemplateRow = {
  icon_path: string;
  id: string;
  owner: string | null;
  slug: string | null;
  name: string;
  width: number;
  height: number;
  text_layers: TextLayer[];
  bg_path: string | null;     // Storage 路徑，如 posters/<uid>/<id>/bg.png
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

/* ===================== 旗標與常數 ===================== */
const BUCKET = process.env.NEXT_PUBLIC_POSTER_BUCKET || "poster-assets";
const IS_PUBLIC_BUCKET = String(process.env.NEXT_PUBLIC_POSTER_BUCKET_PUBLIC ?? "true") === "true";

/** 是否停用 Poster 認證（前端/伺服端兩種旗標皆支援；前端僅能讀 NEXT_PUBLIC_*） */
export const isPosterAuthDisabled =
  process.env.NEXT_PUBLIC_DISABLE_AUTH_POSTER === "true" ||
  process.env.DISABLE_AUTH_POSTER === "true";

/* ===================== 內部工具 ===================== */
function requireSb(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 尚未初始化。請確認 .env.local 並重啟 dev。");
  return sb;
}

/** DataURL -> Blob */
function dataUrlToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ===================== URL 轉換（Public / Private 皆可） ===================== */
/** Public bucket：轉 public URL */
export function toPublicUrl(path?: string | null): string {
  if (!path) return "";
  const sb = requireSb();
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Private bucket：產生簽名網址（預設 1 小時） */
export async function toSignedUrl(path?: string | null, expiresSec = 3600): Promise<string> {
  if (!path) return "";
  const sb = requireSb();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}

/** 依 bucket 公私自動決定回傳連結 */
export async function resolveBgUrl(path?: string | null): Promise<string> {
  if (!path) return "";
  return IS_PUBLIC_BUCKET ? toPublicUrl(path) : await toSignedUrl(path);
}

/* ===================== Auth：只允許 Google（可選擇性停用） ===================== */
/**
 * 確認登入：
 * - 若設置 DISABLE_AUTH_POSTER / NEXT_PUBLIC_DISABLE_AUTH_POSTER 為 true，回傳匿名使用者（不跳轉）
 * - 否則：未登入時觸發 Google OAuth；回來由 /auth/callback 交換 session
 */
export async function ensureLogin() {
  // 免登入模式（Poster）：直接給匿名使用者（配合 RLS/Policy 放行）
  if (isPosterAuthDisabled) {
    return { id: "anon-poster", email: "anon@poster.local" } as any;
  }

  const sb = requireSb();
  const { data: { user } } = await sb.auth.getUser();
  if (user) return user;

  await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  // 不會抵達這裡（因為已跳轉），保險起見留著
  throw new Error("Redirecting to Google OAuth…");
}

/* ===================== Templates：CRUD ===================== */
/** 列出模板（交由 RLS 控制可見性；這裡只排序） */
export async function listTemplates(): Promise<TemplateRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("talent_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TemplateRow[];
}

/** 依 slug 或 id 讀取單筆（B 端常用；RLS 會限制只能看已發布或自己的） */
export async function getTemplateBySlugOrId(slugOrId: string): Promise<TemplateRow> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("talent_templates")
    .select("*")
    .or(`id.eq.${slugOrId},slug.eq.${slugOrId}`)
    .single();
  if (error) throw error;
  return data as TemplateRow;
}

/** 依名稱查找（A 端覆蓋時用） */
export async function getTemplateByName(name: string): Promise<TemplateRow | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("talent_templates")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as TemplateRow) ?? null;
}

/** 建立/更新模板：自動補上 owner（RLS 會再次驗證） */
export async function upsertTemplate(row: any) {
  const sb = requireSb();
  const { data, error } = await sb
    .from("talent_templates")
    .upsert(row, { onConflict: "id" })  // ✅ 關鍵：以 id 為主鍵覆蓋
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** 依名稱刪除（僅刪自己的；RLS 也會擋） */
export async function deleteTemplateByName(name: string) {
  const sb = requireSb();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("未登入，無法刪除");

  const { data, error } = await sb
    .from("talent_templates")
    .delete()
    .eq("name", name)
    .eq("owner", user.id) // 只刪自己的
    .select("id");
  if (error) throw error;
  return data as { id: string }[];
}

/* ===================== Storage：背景圖 ===================== */
/**
 * 上傳背景圖到 Storage，回傳儲存路徑；會依使用者分隔資料夾
 * 🔒 注意：這支函式仍然需要登入（因為要用 user.id 作為路徑）。
 * 若你要在 Poster 免登入時也能上傳，請另外：
 *  1) 規劃匿名上傳的資料夾（如 posters/anon/<token>/...）
 *  2) 在 Supabase Storage Policy 允許 anon 對該前綴 INSERT
 *  3) 依免登入情境改造本函式（我可以再幫你寫一個 anon 版本）
 */
export async function uploadBgDataUrl(templateId: string, dataUrl: string) {
  const sb = requireSb();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("未登入，無法上傳");

  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "bin";
  const path = `posters/${user.id}/${templateId}/bg.${ext}`;

  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) throw error;
  return path; // e.g. posters/<uid>/<templateId>/bg.png
}
