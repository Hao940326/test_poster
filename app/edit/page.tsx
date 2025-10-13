"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";
import { listTemplates, toPublicUrl } from "@/lib/dbApi";

/* ---------------- Types ---------------- */
type TextLayer = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  weight: number;
  align: "left" | "center" | "right";
  uppercase?: boolean;
  italic?: boolean;
  shadow?: boolean;
};

type TemplateRowLite = {
  id: string;
  name: string;
  width: number;
  height: number;
  bg_path?: string | null;
  icon_path?: string | null;
  text_layers: TextLayer[];
};

/* ---------------- Utils ---------------- */
const placeholder =
  "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";

/** ✅ 預設公司 LOGO（請換成你的公開網址） */
const DEFAULT_LOGO =
  "data:image/png;base64,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";

function safeKey(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/** 基底名稱：去尾碼（空白/底線/連字/「款/版」+ 數字），例 AI1、AI-01、AI_2、AI款3 -> AI */
function baseName(name: string) {
  if (!name) return "";
  const half = name.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
  return half.trim().replace(/(?:[\s_-]*?(?:款|版)?)?\s*[_\- ]*\d+\s*$/u, "");
}

/** 取名稱尾數字；沒有則回 -1（用於排序讓「無尾碼」排最前） */
function tailNumber(s: string) {
  s = s.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
  const m = s.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : -1;
}

/** 右側四個欄位：用 label 關鍵字自動對應 */
const FIELD_KEYS = [
  { key: "school", match: /補習班|機構|班名|店名|名稱/i, label: "補習班名稱：" },
  { key: "date", match: /日期|time|day|時段/i, label: "課程日期：" },
  { key: "phone", match: /專線|電話|phone|聯絡/i, label: "報名專線：" },
  { key: "addr", match: /地址|地點|address|上課地點/i, label: "上課地址：" },
] as const;

const CATEGORY_STYLES: Record<string, { dot: string; pill: string }> = {
  "創意手作": { dot: "bg-[#F2A7AF]", pill: "bg-[#F2A7AF] text-white" },
  "金智挑戰": { dot: "bg-[#EFAB67]", pill: "bg-[#EFAB67] text-white" },
  "STEAM啟航": { dot: "bg-[#799DBF]", pill: "bg-[#799DBF] text-white" },
  "律動節奏": { dot: "bg-[#D389C2]", pill: "bg-[#D389C2] text-white" },
  其他: { dot: "bg-slate-300", pill: "bg-slate-500 text-white" },
};

/* 用名稱猜分類（之後可改成 DB 欄位） */
function guessCategory(name: string): string {
  name = baseName(name);
  if (/3D筆|拼豆|黏土|水珠|氣球/i.test(name)) return "創意手作";
  if (/卡牌|桌遊|魔方|魔術|吸管|骨牌/i.test(name)) return "金智挑戰";
  if (/機械|科學|昆蟲|AI|積木/i.test(name)) return "STEAM啟航";
  if (/疊杯|卡林巴|舞蹈|體適能/i.test(name)) return "律動節奏";
  return "其他";
}

/** 依基底名分組後，只取每組代表模板（無尾碼優先，其次數字最小） */
function representativesByBase(list: TemplateRowLite[]) {
  const buckets = new Map<string, TemplateRowLite[]>();
  for (const t of list) {
    const b = baseName(t.name);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(t);
  }
  const reps: TemplateRowLite[] = [];
  for (const [, arr] of buckets) {
    arr.sort((a, b) => {
      const na = tailNumber(a.name), nb = tailNumber(b.name);
      if (na === nb) return a.name.localeCompare(b.name, "zh-Hant");
      return na - nb;
    });
    reps.push(arr[0]); // 每組代表
  }
  return reps;
}

/* ---------------- Page ---------------- */
export default function BPage() {
  const supabase = useMemo<SupabaseClient>(() => getSupabase(), []);
  const [templates, setTemplates] = useState<TemplateRowLite[]>([]);
  const [picked, setPicked] = useState<TemplateRowLite | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const stageWrapRef = useRef<HTMLDivElement>(null);

  // === LOGO 狀態 ===
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState({
    x: 0,
    y: 0,
    size: 300, // 預設放大
  });


  /* ---------------- 初次載入 ---------------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await listTemplates();
        const mapped: TemplateRowLite[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          width: r.width,
          height: r.height,
          bg_path: r.bg_path,
          icon_path: r.icon_path ?? `icons/icon-${safeKey(r.name)}.png`,
          text_layers: r.text_layers,
        }));
        setTemplates(mapped);
        // ❌ 不預設選任何模板；只放公司 LOGO
        setLogoUrl(DEFAULT_LOGO);
        setLogoPos({
        x: (1080 - 300) / 2, // 寬度 1080 為預設畫布，logo 寬 300
        y: (1528 - 300) / 2, // 高度 1528 為預設畫布
        size: 300,
      });

      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 取得 icon (Storage public) */
  function getIconUrl(t: TemplateRowLite) {
    const path = t.icon_path!;
    const { data } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(encodeURI(path));
    return data?.publicUrl ?? placeholder;
  }

  /** 只用背景圖當縮圖；沒有就顯示 placeholder */
  function getThumbFromBg(t: TemplateRowLite) {
    const p = t.bg_path;
    if (!p) return placeholder;
    return /^https?:|^data:image\//.test(p) ? p : toPublicUrl(encodeURI(p));
  }

  function selectTemplate(t: TemplateRowLite) {
    setPicked(t);

    // 文字初始化
    const init: Record<string, string> = {};
    for (const L of t.text_layers) init[L.id] = L.text;
    setValues(init);

    // ✅ 一按模板就把 Logo 隱藏/移除
    setLogoUrl(null);
  }

  function setFieldForLabel(match: RegExp, text: string) {
    if (!picked) return;
    const hit = picked.text_layers.find((l) => match.test(l.label));
    if (!hit) return;
    setValues((o) => ({ ...o, [hit.id]: text }));
  }

  // 從右側表單抓目前值（對應文字層）
  function getFieldValue(fieldKey: typeof FIELD_KEYS[number]["key"]) {
    if (!picked) return "";
    const conf = FIELD_KEYS.find((f) => f.key === fieldKey)!;
    const hit = picked.text_layers.find((l) => conf.match.test(l.label));
    return hit ? values[hit.id] ?? "" : "";
  }

  // 安全檔名
  function toSafeFilename(s: string, fallback = "未命名") {
    s = (s ?? "").replace(/\u3000/g, " ").trim();
    s = s.replace(/[\\\/:\*\?"<>\|\u0000-\u001F]/g, "");
    s = s.replace(
      /[\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu,
      ""
    );
    s = s.replace(/\s+/g, " ");
    if (!s) s = fallback;
    if (s.length > 80) s = s.slice(0, 80).trim();
    return s;
  }

  /* ---------------- 下載 PDF ---------------- */
  async function downloadPDF() {
    if (!stageWrapRef.current || !picked) return; // 未選模板不允許下載
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const w = picked.width;
    const h = picked.height;
    const stage =
      stageWrapRef.current.querySelector<HTMLDivElement>("[data-stage]");
    if (!stage) return;

    const canvas = await html2canvas(stage, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        const cloned = doc.querySelector("[data-stage]") as HTMLElement | null;
        if (cloned) {
          cloned.style.transform = "none";
          cloned.style.transformOrigin = "top left";
          cloned.style.width = `${w}px`;
          cloned.style.height = `${h}px`;
        }
      },
    });

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
    pdf.internal.scaleFactor = 1;

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / w, pageH / h);
    const imgW = w * ratio;
    const imgH = h * ratio;
    const offsetX = (pageW - imgW) / 2;
    const offsetY = (pageH - imgH) / 2;

    pdf.addImage(imgData, "PNG", offsetX, offsetY, imgW, imgH, undefined, "FAST");

    // 檔名：補習班名稱 + 基底才藝名
    const schoolInput = getFieldValue("school");
    const courseBase = baseName(picked?.name ?? "");
    const fileName = `${toSafeFilename(schoolInput)}_${toSafeFilename(
      courseBase
    )}.pdf`;
    pdf.save(fileName);
  }

  /* ---------------- 預覽尺寸 ---------------- */
  const w = picked?.width ?? 1080;
  const h = picked?.height ?? 1528;
  const MAX_PREVIEW_WIDTH = 460;
  const scale = Math.min(MAX_PREVIEW_WIDTH / w, 1);

  // 把滑鼠/觸控座標 -> 海報原始 px（校正 scale）
  const getStagePoint = (clientX: number, clientY: number) => {
    const rect = stageWrapRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  // LOGO 拖曳
  const startDragLogo = (startX: number, startY: number) => {
    const offX = startX - logoPos.x;
    const offY = startY - logoPos.y;

    const onMove = (cx: number, cy: number) => {
      const { x, y } = getStagePoint(cx, cy);
      const maxX = Math.max(0, w - logoPos.size);
      const maxY = Math.max(0, h - logoPos.size);
      setLogoPos((o) => ({
        ...o,
        x: Math.max(0, Math.min(x - offX, maxX)),
        y: Math.max(0, Math.min(y - offY, maxY)),
      }));
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      onMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchEnd, { passive: false });
  };

  /* --------- 兄弟模板：同系列多樣式（例：AI / AI1 / AI2） --------- */
  const siblings = useMemo(() => {
    if (!picked) return [] as TemplateRowLite[];
    const bn = baseName(picked.name);
    const same = templates.filter((t) => baseName(t.name) === bn);
    return same.sort((a, b) => {
      const na = tailNumber(a.name), nb = tailNumber(b.name);
      if (na === nb) return a.name.localeCompare(b.name, "zh-Hant");
      return na - nb; // 無數字(-1) 會排最前
    });
  }, [picked, templates]);

  /* --------- 右側選課（只顯示每系列代表） --------- */
  const grouped = useMemo(() => {
    const reps = representativesByBase(templates);
    const map = new Map<string, TemplateRowLite[]>();
    for (const t of reps) {
      const cat = guessCategory(t.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    for (const v of map.values())
      v.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    const order = ["創意手作", "金智挑戰", "STEAM啟航", "律動節奏", "其他"];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ name: k, items: map.get(k)! }));
  }, [templates]);

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1180px] mx-auto p-8 grid grid-cols-12 gap-10">
        {/* 左：預覽區 */}
        <div className="col-span-5">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="inline-block px-4 py-1 rounded-full bg-black text-white text-[14px] font-bold shadow">
              海報預覽
            </span>
          </div>

          <div
            className="relative mx-auto shadow rounded border border-slate-200 bg-white"
            style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
            ref={stageWrapRef}
          >
            <div
              data-stage
              className="absolute top-0 left-0"
              style={{
                width: w,
                height: h,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                backgroundImage: picked?.bg_path
                  ? `url(${toPublicUrl(encodeURI(picked.bg_path))})`
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* 文字層：只有選了模板才顯示 */}
              {picked &&
                picked.text_layers.map((L) => (
                  <div
                    key={L.id}
                    className="absolute select-none px-1"
                    style={{
                      left: L.x,
                      top: L.y,
                      width: Math.max(1, L.width),
                      color: L.color,
                      fontSize: L.fontSize,
                      fontWeight: L.weight,
                      fontStyle: L.italic ? "italic" : "normal",
                      textAlign: L.align as any,
                      textTransform: L.uppercase ? "uppercase" : "none",
                      textShadow: L.shadow ? "0 2px 6px rgba(0,0,0,.35)" : "none",
                      lineHeight: 1.1,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      zIndex: 10,
                    }}
                  >
                    {values[L.id] !== undefined ? values[L.id] : L.text}
                  </div>
                ))}

              {/* LOGO 層（可拖曳/縮放）— 初次載入會看到 DEFAULT_LOGO */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    left: logoPos.x,
                    top: logoPos.y,
                    width: logoPos.size,
                    height: "auto",
                    cursor: "grab",
                    zIndex: 50,
                    userSelect: "none",
                    pointerEvents: "auto",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const p = getStagePoint(e.clientX, e.clientY);
                    startDragLogo(p.x, p.y);
                  }}
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    if (!t) return;
                    const p = getStagePoint(t.clientX, t.clientY);
                    startDragLogo(p.x, p.y);
                  }}
                />
              )}
            </div>
          </div>

          {/* 左下：同系列模板切換（只有選了模板才顯示） */}
          {picked && siblings.length > 0 && (
            <div className="mt-6">
              <div className="text-[13px] mb-2 font-semibold text-slate-700">
                選擇模板
              </div>
              <div className="flex gap-3">
                {siblings.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setPicked(tpl)}
                    className={`w-14 h-16 rounded-xl shadow border overflow-hidden ${
                      picked?.id === tpl.id ? "ring-2 ring-black" : ""
                    }`}
                    title={tpl.name}
                  >
                    <img
                      src={getThumbFromBg(tpl)}
                      onError={(e) => (e.currentTarget.src = placeholder)}
                      className="w-full h-full object-cover"
                      alt={tpl.name}
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 上傳 LOGO */}
          <div className="mt-6">
            <div className="text-[13px] mb-2 font-semibold text-slate-700">
              上傳LOGO
            </div>
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 grid place-items-center cursor-pointer hover:border-slate-400">
              <span className="text-2xl">＋</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setLogoUrl(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </label>

            {logoUrl && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm">大小：</label>
                  <input
                    type="range"
                    min="40"
                    max="320"
                    value={logoPos.size}
                    onChange={(e) =>
                      setLogoPos((o) => ({ ...o, size: +e.target.value }))
                    }
                  />
                  <span className="text-xs text-slate-500">
                    {logoPos.size}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">位置：</span>
                  <button
                    onClick={() => setLogoPos((o) => ({ ...o, y: o.y - 1 }))}
                    className="px-2 py-1 border rounded"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => setLogoPos((o) => ({ ...o, y: o.y + 1 }))}
                    className="px-2 py-1 border rounded"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setLogoPos((o) => ({ ...o, x: o.x - 1 }))}
                    className="px-2 py-1 border rounded"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setLogoPos((o) => ({ ...o, x: o.x + 1 }))}
                    className="px-2 py-1 border rounded"
                  >
                    →
                  </button>
                  {/* 刪除 => 恢復成公司預設 LOGO */}
                  <button
                    onClick={() => setLogoUrl(DEFAULT_LOGO)}
                    className="ml-3 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm shadow hover:bg-red-600 active:scale-95"
                  >
                    刪除 Logo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右：選課 + 表單 + 下載 */}
        <div className="col-span-7">
          {/* 選擇課程（分類群組；只顯示代表模板） */}
          <div className="mb-6">
            <span className="inline-block px-4 py-1 rounded-full bg-black text-white text-[14px] font-bold shadow">
              選擇課程
            </span>

            <div className="mt-4 space-y-6">
              {loading ? (
                <div className="text-slate-500">載入中…</div>
              ) : (
                grouped.map((grp) => {
                  const s =
                    CATEGORY_STYLES[grp.name] ?? CATEGORY_STYLES["其他"];
                  return (
                    <div key={grp.name}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${s.dot}`}
                        />
                        <span
                          className={`text-[12px] px-3 py-1 rounded-full ${s.pill}`}
                        >
                          {grp.name}
                        </span>
                        <div className="grow border-dotted border-b border-slate-300 ml-2" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {grp.items.map((t) => {
                          const iconUrl = getIconUrl(t);
                          return (
                            <button
                              key={t.id}
                              onClick={() => selectTemplate(t)}
                              className={`w-[80px] h-[80px] p-1 rounded-xl border hover:shadow transition flex items-center justify-center ${
                                picked?.id === t.id
                                  ? "ring-2 ring-slate-900"
                                  : ""
                              }`}
                              title={baseName(t.name)}
                            >
                              <img
                                src={iconUrl}
                                onError={(e) =>
                                  ((e.currentTarget.src = placeholder))
                                }
                                className="w-[64px] h-[64px] object-contain"
                                alt={baseName(t.name)}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 輸入資訊四欄 */}
          <div className="mb-6">
            <span className="inline-block px-4 py-1 rounded-full bg-black text-white text-[14px] font-bold shadow">
              輸入資訊
            </span>

            <div className="mt-4 space-y-3">
              {FIELD_KEYS.map(({ key, match, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-32 text-sm text-slate-700">{label}</label>
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border focus:ring-2 focus:ring-slate-900/30 outline-none"
                    placeholder="請輸入…"
                    value={
                      picked
                        ? (() => {
                            const hit = picked.text_layers.find((l) =>
                              match.test(l.label)
                            );
                            return hit ? values[hit.id] ?? "" : "";
                          })()
                        : ""
                    }
                    onChange={(e) => setFieldForLabel(match, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 下載 PDF */}
          <div className="mt-2">
            <button
              onClick={downloadPDF}
              className="px-6 py-3 rounded-full bg-black text-white font-semibold shadow active:scale-95 transition inline-flex items-center gap-2"
              disabled={!picked}
            >
              下載 PDF 列印
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 頁尾 */}
      <footer className="mt-10 bg-[#FFC840] text-[12px] text-white/90 py-3 text-center tracking-wider">
        國王才藝 KING'S TALENT ｜本平台模板由國王才藝原創設計，僅限才藝機構之招生宣傳使用，請勿轉售、重製或作商業用途。
      </footer>
    </div>
  );
}
