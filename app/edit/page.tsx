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
  const [logoPos, setLogoPos] = useState({ x: 60, y: 60, size: 120 });

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
        if (mapped.length > 0) selectTemplate(mapped[0]);
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
    const init: Record<string, string> = {};
    for (const L of t.text_layers) init[L.id] = L.text;
    setValues(init);
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
    if (!stageWrapRef.current || !picked) return;
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
              {/* 文字層 */}
              {picked?.text_layers.map((L) => (
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

              {/* LOGO 層（可拖曳/縮放） */}
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

          {/* 左下：同系列模板切換（縮圖只抓 bg_path） */}
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
                  <button
                    onClick={() => setLogoUrl(null)}
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
