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

/** 右側四個欄位：用 label 關鍵字自動對應 */
const FIELD_KEYS = [
  { key: "school", match: /補習班|機構|班名|店名/i, label: "補習班名稱：" },
  { key: "date", match: /日期|time|day|時段/i, label: "課程日期：" },
  { key: "phone", match: /專線|電話|phone|聯絡/i, label: "報名專線：" },
  { key: "addr", match: /地址|地點|address|上課地點/i, label: "上課地址：" },
] as const;

/* ---------------- Page ---------------- */
export default function BPage() {
  const supabase = useMemo<SupabaseClient>(() => getSupabase(), []);
  const [templates, setTemplates] = useState<TemplateRowLite[]>([]);
  const [picked, setPicked] = useState<TemplateRowLite | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [themeIdx, setThemeIdx] = useState<number>(0);

  // === logo 狀態 ===
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState({ x: 50, y: 50, size: 120 });
  const logoRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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

  function getIconUrl(t: TemplateRowLite) {
    const path = t.icon_path!;
    const { data } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(encodeURI(path));
    return data?.publicUrl ?? placeholder;
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

  /* ---------------- 下載 PDF ---------------- */
  async function downloadPDF() {
    if (!canvasRef.current || !picked) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const w = picked.width;
    const h = picked.height;
    const stage = canvasRef.current.querySelector<HTMLDivElement>("[data-stage]");
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
    pdf.save(`${picked.name}-A4.pdf`);
  }

  /* ---------------- 預覽尺寸 ---------------- */
  const w = picked?.width ?? 1080;
  const h = picked?.height ?? 1528;
  const MAX_PREVIEW_WIDTH = 420;
  const scale = Math.min(MAX_PREVIEW_WIDTH / w, 1);

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="grid grid-cols-12 gap-8">
        {/* 左：預覽畫面 */}
        <div className="col-span-5">
          <div className="relative">
            <div className="absolute -top-6 left-2 text-xs bg-black text-white px-3 py-1 rounded-full">
              預覽畫面
            </div>
          </div>

          <div
            className="relative mx-auto shadow rounded overflow-hidden bg-white"
            style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
            ref={canvasRef}
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
                  ? `url(${toPublicUrl(picked.bg_path)})`
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* 顏色樣板覆蓋 */}
              {themeIdx > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none mix-blend-multiply"
                  style={{
                    background:
                      themeIdx === 1
                        ? "rgba(255,240,200,.25)"
                        : "rgba(200,220,255,.25)",
                  }}
                />
              )}

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

              {/* 客戶 Logo 層（可拖曳） */}
              {logoUrl && (
                <img
                  ref={logoRef}
                  src={logoUrl}
                  alt="Logo"
                  style={{
                    position: "absolute",
                    left: logoPos.x,
                    top: logoPos.y,
                    width: logoPos.size,
                    height: "auto",
                    cursor: dragging ? "grabbing" : "grab",
                    zIndex: 50,
                    userSelect: "none",
                    pointerEvents: "auto",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragging(true);

                    // 修正 scale 比例：實際像素 = 事件位置 / scale
                    const rect = canvasRef.current!.getBoundingClientRect();
                    const realX = (e.clientX - rect.left) / scale;
                    const realY = (e.clientY - rect.top) / scale;

                    setOffset({
                      x: realX - logoPos.x,
                      y: realY - logoPos.y,
                    });

                    // 綁定全域事件
                    const onMove = (ev: MouseEvent) => {
                      if (!dragging) return;
                      const rx = (ev.clientX - rect.left) / scale;
                      const ry = (ev.clientY - rect.top) / scale;
                      setLogoPos((o) => ({
                        ...o,
                        x: rx - offset.x,
                        y: ry - offset.y,
                      }));
                    };
                    const onUp = () => setDragging(false);

                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp, { once: true });

                    // 清理
                    window.addEventListener(
                      "mouseup",
                      () => {
                        window.removeEventListener("mousemove", onMove);
                      },
                      { once: true }
                    );
                  }}
                />
              )}

            </div>
          </div>

          {/* 設計樣板選擇 */}
          <div className="mt-4">
            <div className="inline-block text-xs bg-black text-white px-3 py-1 rounded-full mb-2">
              選擇設計樣板
            </div>
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setThemeIdx(i)}
                  className={`w-10 h-14 rounded shadow border ${
                    themeIdx === i ? "ring-2 ring-black" : ""
                  }`}
                  style={{
                    background:
                      i === 0
                        ? "#f8f8f8"
                        : i === 1
                        ? "linear-gradient(#ffe7a8,#ffd47a)"
                        : "linear-gradient(#dbe8ff,#b9d1ff)",
                  }}
                  title={`款${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 右：操作區 */}
        <div className="col-span-7">
          {/* STEP1 選擇課程 */}
          <div className="mb-6">
            <div className="inline-block text-xs bg-black text-white px-3 py-1 rounded-full mb-2">
              選擇課程
            </div>
            {loading ? (
              <div className="text-slate-500">載入中…</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {templates.map((t) => {
                  const iconUrl = getIconUrl(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className={`flex flex-col items-center p-2 rounded-xl border hover:shadow transition ${
                        picked?.id === t.id ? "ring-2 ring-black" : ""
                      }`}
                      title={t.name}
                    >
                      <img
                        src={iconUrl}
                        onError={(e) => ((e.currentTarget.src = placeholder))}
                        className="w-14 h-14 object-cover rounded mb-1"
                        alt={t.name}
                      />
                      <span className="text-[11px] text-slate-700">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP2 輸入文字 */}
          <div className="mb-6">
            <div className="inline-block text-xs bg-black text-white px-3 py-1 rounded-full mb-2">
              輸入文字
            </div>
            <div className="space-y-3">
              {FIELD_KEYS.map(({ key, match, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-28 text-sm text-slate-700">{label}</label>
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border"
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

          {/* STEP2.5 上傳 LOGO */}
          <div className="mb-6">
            <div className="inline-block text-xs bg-black text-white px-3 py-1 rounded-full mb-2">
              上傳 LOGO（可拖曳與縮放）
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setLogoUrl(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-sm">大小：</label>
                <input
                  type="range"
                  min="40"
                  max="300"
                  value={logoPos.size}
                  onChange={(e) =>
                    setLogoPos((o) => ({ ...o, size: +e.target.value }))
                  }
                />
                <span className="text-xs text-slate-500">
                  {logoPos.size}px
                </span>
              </div>
            )}
          </div>

          {/* STEP3 下載 PDF */}
          <div>
            <div className="inline-block text-xs bg-black text-white px-3 py-1 rounded-full mb-2">
              下載PDF列印檔
            </div>
            <button
              onClick={downloadPDF}
              className="px-6 py-3 rounded-full bg-black text-white font-semibold shadow active:scale-95 transition inline-flex items-center gap-2"
              disabled={!picked}
            >
              DOWNLOAD
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
    </div>
  );
}
