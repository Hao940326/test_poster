"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";
import {
  TextLayer, TemplateRow,
  listTemplates, upsertTemplate, getTemplateByName, deleteTemplateByName,
  ensureLogin, uploadBgDataUrl, toPublicUrl
} from "@/lib/dbApi";

/* ------------------- 🔐 登入頂欄（只留 Google） ------------------- */
function LoginBar({ supabase, onUser }: { supabase: SupabaseClient; onUser: (u: any|null)=>void }) {
  const [user, setUser] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let unsub = () => {};
    // 用同步函式包住 async，確保 cleanup 能正確返回
    const run = async () => {
      // 1) 先抓 session
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      setUser(u);
      onUser(u);

      // 2) 檢查 allowed_users —— ❗只要「查不到」或「錯誤」，都視為拒絕
      if (u?.email) {
        const email = u.email.toLowerCase();
        const { data, error } = await supabase
          .from("allowed_users")
          .select("email")
          .eq("email", email)
          .maybeSingle();

        if (error || !data) {
          // 👉 這裡與原本不同：出錯也當不允許
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "denied_reason",
              error ? `allowed_users 查詢失敗：${error.message}` : `不在允許名單：${email}`
            );
            window.location.href = "/access-denied";
          }
          return; // 直接結束，不要往下訂閱
        }
      }

      // 3) 訂閱登入狀態變化
      const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
        const u2 = session?.user ?? null;
        setUser(u2);
        onUser(u2);

        if (!u2?.email) return;

        const email2 = u2.email.toLowerCase();
        const { data, error } = await supabase
          .from("allowed_users")
          .select("email")
          .eq("email", email2)
          .maybeSingle();

        // 👉 同樣：出錯或查不到 = 拒絕
        if (error || !data) {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "denied_reason",
              error ? `allowed_users 查詢失敗：${error.message}` : `不在允許名單：${email2}`
            );
            window.location.href = "/access-denied";
          }
        }
      });

      unsub = () => sub.subscription.unsubscribe();
    };

    run();
    return () => unsub();
  }, [supabase, onUser]);

  async function loginGoogle() {
    const redirect = "/studio";
    const redirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) setMsg(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setMsg(null);
  }

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <span className="text-sm text-slate-600">已登入：<b>{user.email ?? user.id}</b></span>
          <button className="px-3 py-1.5 rounded border" onClick={logout}>登出</button>
        </>
      ) : (
        <button className="px-3 py-1.5 rounded border" onClick={loginGoogle}>Google 登入</button>
      )}
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

/* ------------------- 🔧 小工具 ------------------- */
// File → DataURL
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// 安全錯誤訊息
function getErrMsg(e: any): string {
  if (!e) return "未知錯誤";
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  if (e.error_description) return e.error_description;
  if (e.statusText) return e.statusText;
  if (e.data?.message) return e.data.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
// 分享用編碼（目前未使用，保留）
function encodeTpl(tpl: any) {
  const str = JSON.stringify(tpl);
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return encodeURIComponent(b64);
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- 型別與預設 ---------------- */
type TplVM = {
  id?: string;
  slug?: string | null;
  name: string;
  width: number;
  height: number;
  bgUrl: string;        // 畫布背景（public URL 或 dataURL）
  textLayers: TextLayer[];
  iconUrl?: string;     // icon 公開網址
};

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_TPL: TplVM = {
  name: "未命名模板",
  width: 1080,
  height: 1528,
  bgUrl: "",
  textLayers: [
    { id: uid(), label: "標題", text: "暑期才藝", x: 60, y: 60, width: 420, fontSize: 96, color: "#ffffff", weight: 800, align: "left", shadow: true },
  ],
};

/* ---------------- 頁面 ------------------- */
export default function StudioPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const [user, setUser] = useState<any | null>(null);

  if (!supabase) {
    return (
      <div className="p-4 text-red-700">
        無法初始化 Supabase。請在 <code>.env.local</code> 設定
        <code> NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY</code>，並重啟 dev。
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">A 端｜模板編輯器</h1>
        <LoginBar supabase={supabase} onUser={setUser} />
      </div>
      <AdminTemplateEditor supabase={supabase} user={user} />
    </div>
  );
}

/* ===================== AdminTemplateEditor（含可縮放畫布） ===================== */

type ZoomMode = number | "fit";
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function AdminTemplateEditor({ supabase, user }: { supabase: SupabaseClient; user: any | null; }) {
  const [allTpls, setAllTpls] = useState<TplVM[]>([]);
  const [tpl, setTpl] = useState<TplVM>(() => DEFAULT_TPL);
  const [selectedId, setSelectedId] = useState<string | null>(DEFAULT_TPL.textLayers[0].id);
  const [loading, setLoading] = useState(false);

  // 🔍 縮放狀態
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [scale, setScale] = useState(1);
  const canvasOuterRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => tpl.textLayers.find((t) => t.id === selectedId) || null,
    [tpl, selectedId]
  );

  // 依容器大小自動計算「整幅置入」倍率
  useEffect(() => {
    if (zoom !== "fit") { setScale(typeof zoom === "number" ? zoom : 1); return; }
    const el = canvasOuterRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const pad = 16;
      const box = el.getBoundingClientRect();
      const availW = Math.max(1, box.width - pad);
      const availH = Math.max(1, box.height - pad);
      const s = Math.min(availW / Math.max(1, tpl.width), availH / Math.max(1, tpl.height));
      setScale(clamp(s, 0.05, 3));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, tpl.width, tpl.height]);

  // 載清單
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await listTemplates();
        setAllTpls(rows.map((r: any) => ({
          id: r.id, slug: r.slug, name: r.name,
          width: r.width, height: r.height,
          textLayers: r.text_layers,
          bgUrl: r.bg_path ? toPublicUrl(r.bg_path) : "",
          iconUrl: r.icon_path ? toPublicUrl(r.icon_path) : "",
        })));
      } catch (e: any) {
        console.group("讀取模板失敗");
        console.dir(e);
        console.groupEnd();
        alert(getErrMsg(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 鍵盤微調（保持原本行為）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const sel = selected;
      if (!sel) return;
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const next = { ...sel };
        if (e.key === "ArrowUp") next.y -= d;
        if (e.key === "ArrowDown") next.y += d;
        if (e.key === "ArrowLeft") next.x -= d;
        if (e.key === "ArrowRight") next.x += d;
        updateLayer(next);
      }
      if (e.key === "Delete") {
        setTpl(o => ({ ...o, textLayers: o.textLayers.filter(l => l.id !== sel.id) }));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  // 圖層 CRUD
  function addLayer() {
    const L: TextLayer = { id: uid(), label: `文字層${tpl.textLayers.length + 1}`, text: "新文字", x: 80, y: 80, width: 360, fontSize: 36, color: "#111", weight: 600, align: "left" };
    setTpl(o => ({ ...o, textLayers: [...o.textLayers, L] }));
    setSelectedId(L.id);
  }
  function updateLayer(next: TextLayer) {
    setTpl(o => ({ ...o, textLayers: o.textLayers.map(l => l.id === next.id ? next : l) }));
  }

  // 拖曳（依縮放倍率換算原始座標）
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  function onMouseDownLayer(e: React.MouseEvent, id: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = (e.clientX - rect.left) / scale;
    const dy = (e.clientY - rect.top) / scale;
    dragRef.current = { id, dx, dy };
    setSelectedId(id);
  }
  function onMouseMoveCanvas(e: React.MouseEvent) {
    if (!dragRef.current) return;
    const host = e.currentTarget as HTMLElement;
    const r = host.getBoundingClientRect();
    const { id, dx, dy } = dragRef.current;

    const xRaw = (e.clientX - r.left) / scale - dx;
    const yRaw = (e.clientY - r.top) / scale - dy;

    const L = tpl.textLayers.find(t => t.id === id);
    if (L) updateLayer({ ...L, x: Math.round(xRaw), y: Math.round(yRaw) });
  }
  function onMouseUpCanvas() { dragRef.current = null; }

  async function onPickBg(file?: File) {
    if (!file) return;
    const url = await fileToDataUrl(file);
    setTpl(o => ({ ...o, bgUrl: url }));
  }

  async function refreshList() {
    try {
      const rows = await listTemplates();
      setAllTpls(rows.map((r: any) => ({
        id: r.id, slug: r.slug, name: r.name,
        width: r.width, height: r.height,
        textLayers: r.text_layers,
        bgUrl: r.bg_path ? toPublicUrl(r.bg_path) : "",
        iconUrl: r.icon_path ? toPublicUrl(r.icon_path) : "",
      })));
    } catch (e: any) {
      console.error(e);
      alert(getErrMsg(e));
    }
  }

  // 另存
  async function saveAsNew() {
    const name = prompt("請輸入模板名稱", tpl.name || "新模板");
    if (!name) return;
    try {
      setLoading(true);
      const sb = getSupabase();
      const { data: { user } } = await sb!.auth.getUser();
      console.log("目前登入 user.id =", user?.id);

      await ensureLogin();
      const id = crypto.randomUUID();

      // 上傳背景圖
      let bg_path: string | undefined;
      if (tpl.bgUrl.startsWith("data:")) {
        bg_path = await uploadBgDataUrl(id, tpl.bgUrl);
      }

      const row = {
        id,
        name,
        width: tpl.width,
        height: tpl.height,
        text_layers: tpl.textLayers,
        bg_path,
        is_published: true,
        owner: user?.id ?? null,
      };
      console.log("準備上傳資料 =", row);

      const saved = await upsertTemplate(row);

      setTpl(o => ({
        ...o,
        id: saved.id,
        bgUrl: saved.bg_path ? toPublicUrl(saved.bg_path) : o.bgUrl,
        iconUrl: saved.icon_path ? toPublicUrl(saved.icon_path) : o.iconUrl,
      }));
      await refreshList();
      alert("已儲存到 Supabase");
    } catch (e: any) {
      console.group("儲存失敗");
      console.dir(e);
      console.groupEnd();
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // 覆蓋
  async function overwriteCurrent(name: string) {
    try {
      setLoading(true);
      await ensureLogin();
      const exist = await getTemplateByName(name);
      const id = exist?.id ?? crypto.randomUUID();

      let bg_path: string | undefined;
      if (tpl.bgUrl.startsWith("data:")) {
        bg_path = await uploadBgDataUrl(id, tpl.bgUrl);
      }

      const saved = await upsertTemplate({
        id,
        name,
        width: tpl.width,
        height: tpl.height,
        text_layers: tpl.textLayers,
        ...(bg_path ? { bg_path } : {}),
        is_published: true,
      });

      setTpl(o => ({
        ...o,
        id: saved.id,
        bgUrl: saved.bg_path ? toPublicUrl(saved.bg_path) : o.bgUrl,
        iconUrl: saved.icon_path ? toPublicUrl(saved.icon_path) : o.iconUrl,
      }));
      await refreshList();
      alert("已覆蓋（Supabase）");
    } catch (e: any) {
      console.group("覆蓋失敗");
      console.dir(e);
      console.groupEnd();
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadByName(name: string) {
    try {
      setLoading(true);
      const exist = await getTemplateByName(name);
      if (exist) {
        setTpl({
          id: exist.id,
          slug: exist.slug,
          name: exist.name,
          width: exist.width,
          height: exist.height,
          textLayers: exist.text_layers,
          bgUrl: exist.bg_path ? toPublicUrl(exist.bg_path) : "",
          iconUrl: exist.icon_path ? toPublicUrl(exist.icon_path) : "",
        });
        setSelectedId(exist.text_layers[0]?.id ?? null);
      }
    } catch (e: any) {
      console.group("讀取失敗");
      console.dir(e);
      console.groupEnd();
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeByName(name: string) {
    if (!confirm(`刪除模板「${name}」？`)) return;
    try {
      setLoading(true);
      await deleteTemplateByName(name);
      await refreshList();
    } catch (e: any) {
      console.group("刪除失敗");
      console.dir(e);
      console.groupEnd();
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // 分享連結資料（目前未使用，保留）
  function tplToShare(t: TplVM) {
    return { width: t.width, height: t.height, bgUrl: t.bgUrl, textLayers: t.textLayers };
  }

  // 單筆上傳 icon
  async function uploadIcon(file: File) {
    await ensureLogin();
    const sb = getSupabase();
    const { data: { user } } = await sb!.auth.getUser();
    if (!user) throw new Error("尚未登入");

    // 確保有模板 id
    let tplId = tpl.id;
    if (!tplId) {
      tplId = crypto.randomUUID();
      await upsertTemplate({
        id: tplId,
        name: tpl.name || "未命名模板",
        width: tpl.width, height: tpl.height,
        text_layers: tpl.textLayers,
        is_published: true,
        owner: user.id,
      });
      setTpl(o => ({ ...o, id: tplId! }));
    }

    const ext = file.type === "image/jpeg" ? "jpg"
              : file.type === "image/webp" ? "webp"
              : "png";
    const storagePath = `posters/${user.id}/${tplId}/icon.${ext}`;

    const { error: upErr } = await sb!.storage
      .from("poster-assets")
      .upload(storagePath, file, {
        cacheControl: "31536000",
        upsert: true,
        contentType: file.type || "image/png",
      });
    if (upErr) throw upErr;

    const { error: dbErr } = await sb!
      .from("talent_templates")
      .update({ icon_path: storagePath, icon_mime: file.type || "image/png" })
      .eq("id", tplId);
    if (dbErr) throw dbErr;

    setTpl(o => ({ ...o, iconUrl: toPublicUrl(storagePath) }));
    await refreshList();
    alert("✅ icon 已上傳");
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full min-h-screen grid grid-cols-12 gap-4 p-4 bg-slate-50">
      {/* 左欄：模板管理與畫布設定 */}
      <div className="col-span-3 space-y-4">
        <div className="p-4 rounded-2xl shadow bg-white">
          <div className="text-xl font-bold mb-2">
            模板管理 {loading && <span className="text-sm text-slate-500">(處理中…)</span>}
          </div>
          <div className="flex gap-2 mb-3">
            <button
              className="px-3 py-2 rounded-xl shadow text-white bg-slate-900 disabled:opacity-50"
              onClick={saveAsNew}
              disabled={!user}
            >
              另存新模板
            </button>
            <button
              className="px-3 py-2 rounded-xl shadow border disabled:opacity-50"
              onClick={() => { const name = prompt("覆蓋哪個模板名稱？", tpl.name); if (name) overwriteCurrent(name); }}
              disabled={!user}
            >
              覆蓋同名
            </button>
          </div>
          {allTpls.length === 0 ? (
            <div className="text-slate-500 text-sm">尚無已存模板</div>
          ) : (
            <ul className="max-h-72 overflow-auto space-y-1">
              {allTpls.map((t) => (
                <li key={t.id ?? t.name} className="flex items-center justify-between gap-2">
                  <button className="text-left flex-1 px-2 py-1 rounded hover:bg-slate-100" onClick={() => loadByName(t.name)}>
                    <span className="inline-flex items-center gap-2">
                      {t.iconUrl ? <img src={t.iconUrl} className="w-5 h-5 object-contain border rounded" alt="" /> : null}
                      {t.name}
                    </span>
                  </button>
                  <button className="text-red-600 text-sm" onClick={() => removeByName(t.name)}>刪除</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-2xl shadow bg-white">
          <div className="text-xl font-bold mb-3">畫布設定</div>
          <label className="block text-sm mb-1">模板名稱</label>
          <input className="w-full border rounded-xl px-3 py-2 mb-3" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm mb-1">寬(px)</label>
              <input type="number" className="w-full border rounded-xl px-3 py-2" value={tpl.width} onChange={(e) => setTpl({ ...tpl, width: parseInt(e.target.value || "0") || 0 })} />
            </div>
            <div>
              <label className="block text-sm mb-1">高(px)</label>
              <input type="number" className="w-full border rounded-xl px-3 py-2" value={tpl.height} onChange={(e) => setTpl({ ...tpl, height: parseInt(e.target.value || "0") || 0 })} />
            </div>
          </div>
          <div className="w-full border rounded-xl p-2 text-sm bg-slate-50">
            <label className="block text-sm">背景圖</label>
            <input type="file" accept="image/*" onChange={(e) => onPickBg(e.target.files?.[0])} />
          </div>

          {/* Icon 上傳 */}
          <div className="mt-4">
            <div className="block text-sm font-semibold mb-1">Icon 上傳</div>
            <div className="w-full border rounded-xl p-2 text-sm bg-slate-50">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  uploadIcon(f).catch(err => alert("上傳失敗：" + getErrMsg(err)));
                }}
              />
              {tpl.iconUrl ? (
                <img
                  src={tpl.iconUrl}
                  alt="icon"
                  className="w-10 h-10 object-contain border rounded"
                  title="目前 icon"
                />
              ) : (
                <span className="text-xs text-slate-500">尚未上傳</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              會儲存到 <code>poster-assets/posters/&lt;userId&gt;/&lt;templateId&gt;/icon.&lt;ext&gt;</code>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl shadow bg-white space-y-2">
          <div className="text-xl font-bold">匯出 / 分享</div>
          <button
            className="w-full px-3 py-2 rounded-xl shadow bg-emerald-600 text-white"
            onClick={() => downloadText(`${tpl.name || "template"}.json`, JSON.stringify(tpl, null, 2))}
          >
            下載 JSON
          </button>
          <button
            className="w-full px-3 py-2 rounded-xl shadow bg-indigo-600 text-white"
            onClick={() => {
              window.location.href = "https://test-poster-7dyz.vercel.app/edit";//雲端
              //window.location.href = "http://localhost:3000/edit";//本機
            }}
          >
            前往 B 端頁面
          </button>

          <hr className="my-2" />
          <label className="block text-sm font-semibold mb-1">載入 JSON 模板</label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const obj = JSON.parse(text);
                if (!obj.width || !obj.height || !obj.textLayers) {
                  alert("這不是有效的模板 JSON 檔案");
                  return;
                }
                setTpl(obj);
                setSelectedId(obj.textLayers[0]?.id ?? null);
                alert("✅ 已成功載入模板 JSON");
              } catch (err: any) {
                console.error(err);
                alert("讀取失敗：" + err.message);
              }
            }}
            className="w-full border rounded-xl p-2 text-sm bg-slate-50"
          />
        </div>
      </div>

      {/* 中欄：畫布（可縮放 + 整幅置入） */}
      <div className="col-span-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xl font-bold">畫布預覽</div>
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-1 rounded border ${zoom==="fit" ? "bg-slate-900 text-white" : ""}`}
              onClick={() => setZoom("fit")}
              title="整幅置入"
            >
              整幅
            </button>
            {[0.25, 0.5, 0.75, 1].map(v => (
              <button
                key={v}
                className={`px-2 py-1 rounded border ${zoom===v ? "bg-slate-900 text-white" : ""}`}
                onClick={() => setZoom(v)}
                title={`${Math.round(v*100)}%`}
              >
                {Math.round(v*100)}%
              </button>
            ))}
            <span className="text-sm text-slate-500 ml-2">
              目前：{Math.round(scale * 100)}%
            </span>
          </div>
        </div>

        <div
          ref={canvasOuterRef}
          className="relative rounded-2xl shadow bg-white overflow-auto p-4"
          style={{ maxHeight: "85vh" }}
        >
          {/* 這個容器負責縮放（不改內部座標） */}
          <div
            className="relative mx-auto border bg-white"
            style={{
              width: Math.max(1, tpl.width),
              height: Math.max(1, tpl.height),
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              backgroundImage: `url(${tpl.bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            onMouseMove={onMouseMoveCanvas}
            onMouseUp={onMouseUpCanvas}
            onMouseLeave={onMouseUpCanvas}
          >
            <GridOverlay w={Math.max(1, tpl.width)} h={Math.max(1, tpl.height)} />
            {tpl.textLayers.map((L) => (
              <div
                key={L.id}
                className={`absolute select-none ${selectedId === L.id ? "ring-2 ring-sky-500" : ""}`}
                style={{ left: L.x, top: L.y, width: Math.max(1, L.width) }}
                onMouseDown={(e) => onMouseDownLayer(e, L.id)}
                onClick={() => setSelectedId(L.id)}
              >
                <div
                  className="px-1 py-0.5"
                  style={{
                    fontSize: Math.max(1, L.fontSize),
                    color: L.color,
                    fontWeight: L.weight,
                    fontStyle: L.italic ? "italic" : "normal",
                    textAlign: L.align as any,
                    textTransform: L.uppercase ? "uppercase" : "none",
                    textShadow: L.shadow ? "0 2px 6px rgba(0,0,0,.35)" : "none",
                    lineHeight: 1.1, whiteSpace: "pre-wrap", wordBreak: "break-word"
                  }}
                >
                  {L.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右欄：圖層清單 + 屬性編輯 */}
      <div className="col-span-3 space-y-4">
        <div className="p-4 rounded-2xl shadow bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xl font-bold">文字層</div>
            <button className="px-3 py-1.5 rounded-xl shadow bg-sky-600 text-white" onClick={addLayer}>新增文字層</button>
          </div>
        {tpl.textLayers.length === 0 ? (
            <div className="text-slate-500 text-sm">尚無文字層</div>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-auto">
              {tpl.textLayers.map((L) => (
                <li key={L.id} className="flex items-center gap-2">
                  <button
                    className={`flex-1 text-left px-2 py-1 rounded ${selectedId === L.id ? "bg-sky-100" : "hover:bg-slate-100"}`}
                    onClick={() => setSelectedId(L.id)}
                  >
                    {L.label}
                  </button>
                  <button
                    className="text-xs text-red-600"
                    onClick={() => {
                      if (!confirm(`刪除「${L.label}」？`)) return;
                      setTpl((o) => ({ ...o, textLayers: o.textLayers.filter(x => x.id !== L.id) }));
                      if (selectedId === L.id) setSelectedId(null);
                    }}
                  >
                    刪除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-2xl shadow bg-white">
          <div className="text-xl font-bold mb-3">屬性（選取一個文字層）</div>
          {!selected ? (
            <div className="text-slate-500 text-sm">尚未選擇文字層</div>
          ) : (
            <LayerEditor layer={selected} onChange={updateLayer} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 小元件 ---------------- */
function GridOverlay({ w, h }: { w: number; h: number }) {
  const gap = 40;
  const cols = Math.floor(w / gap);
  const rows = Math.floor(h / gap);
  const xs = Array.from({ length: cols + 1 }, (_, i) => i * gap);
  const ys = Array.from({ length: rows + 1 }, (_, i) => i * gap);
  return (
    <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
      {xs.map((x) => (<line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#000" opacity={0.05} />))}
      {ys.map((y) => (<line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#000" opacity={0.05} />))}
      <line x1={w/2} y1={0} x2={w/2} y2={h} stroke="#00A3FF" opacity={0.15} />
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="#00A3FF" opacity={0.15} />
    </svg>
  );
}

function LayerEditor({ layer, onChange }: { layer: TextLayer; onChange: (l: TextLayer) => void; }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm mb-1">圖層名稱</label>
        <input className="w-full border rounded-xl px-3 py-2" value={layer.label} onChange={(e)=>onChange({ ...layer, label: e.target.value })}/>
      </div>
      <div>
        <label className="block text-sm mb-1">文字內容（可換行）</label>
        <textarea className="w-full border rounded-xl px-3 py-2 min-h-24" value={layer.text} onChange={(e)=>onChange({ ...layer, text: e.target.value })}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">X</label>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={layer.x} onChange={(e)=>onChange({ ...layer, x: parseInt(e.target.value||"0")||0 })}/>
        </div>
        <div>
          <label className="block text-sm mb-1">Y</label>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={layer.y} onChange={(e)=>onChange({ ...layer, y: parseInt(e.target.value||"0")||0 })}/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">寬度（px）</label>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={layer.width} onChange={(e)=>onChange({ ...layer, width: parseInt(e.target.value||"0")||0 })}/>
        </div>
        <div>
          <label className="block text-sm mb-1">字級（px）</label>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={layer.fontSize} onChange={(e)=>onChange({ ...layer, fontSize: parseInt(e.target.value||"0")||0 })}/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">顏色</label>
          <input type="color" className="w-full h-10 border rounded-xl" value={layer.color} onChange={(e)=>onChange({ ...layer, color: e.target.value })}/>
        </div>
        <div>
          <label className="block text-sm mb-1">粗細</label>
          <select className="w-full border rounded-xl px-3 py-2" value={layer.weight} onChange={(e)=>onChange({ ...layer, weight: Number(e.target.value) as any })}>
            <option value={300}>300</option>
            <option value={400}>400</option>
            <option value={600}>600</option>
            <option value={800}>800</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">對齊</label>
        <div className="flex gap-2">
          {(["left","center","right"] as const).map((k)=>(
            <button key={k} className={`flex-1 px-3 py-2 rounded-xl border ${layer.align===k?"bg-slate-900 text-white":"bg-white"}`} onClick={()=>onChange({ ...layer, align: k })}>{k}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={!!layer.uppercase} onChange={(e)=>onChange({ ...layer, uppercase: e.target.checked })}/>
          <span className="text-sm">全大寫</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={!!layer.italic} onChange={(e)=>onChange({ ...layer, italic: e.target.checked })}/>
          <span className="text-sm">斜體</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={!!layer.shadow} onChange={(e)=>onChange({ ...layer, shadow: e.target.checked })}/>
          <span className="text-sm">陰影</span>
        </label>
      </div>
    </div>
  );
}
