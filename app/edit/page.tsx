"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  CSSProperties,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";
import { listTemplates, toPublicUrl } from "@/lib/dbApi";
import { useRouter } from "next/navigation";

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

/* 右側輸入欄位 key */
type FieldKey = "school" | "date" | "phone" | "addr";

type FieldKeyConfig = {
  key: FieldKey;
  match: RegExp;
  label: string;
  multiline?: boolean;
};

/* ---------------- Utils & Constants ---------------- */
const placeholder =
  "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";

const DEFAULT_LOGO = "/KTlogo.png";

/** Logo 狀態：是否為預設 */
type LogoState = { url: string | null; isDefault: boolean };

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

function baseName(name: string) {
  if (!name) return "";
  const half = name.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
  return half.trim().replace(/(?:[\s_-]*?(?:款|版)?)?\s*[_\- ]*\d+\s*$/u, "");
}

function tailNumber(s: string) {
  s = s.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
  const m = s.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : -1;
}

/** 右側輸入欄位設定 */
const FIELD_KEYS: FieldKeyConfig[] = [
  {
    key: "school",
    match: /補習班|機構|班名|店名|名稱/i,
    label: "補習班名稱：",
    multiline: true, // ✅ 補習班名稱用 textarea，可手動換行
  },
  {
    key: "date",
    match: /日期|time|day|時段/i,
    label: "課程日期：",
  },
  {
    key: "phone",
    match: /專線|電話|phone|聯絡/i,
    label: "報名專線：",
  },
  {
    key: "addr",
    match: /地址|地點|address|上課地點/i,
    label: "上課地址：",
  },
];

const CATEGORY_STYLES: Record<string, { dot: string; pill: string }> = {
  創意手作: { dot: "bg-[#F2A7AF]", pill: "bg-[#F2A7AF] text-white" },
  益智挑戰: { dot: "bg-[#EFAB67]", pill: "bg-[#EFAB67] text-white" },
  STEAM啟航: { dot: "bg-[#799DBF]", pill: "bg-[#799DBF] text-white" },
  律動節奏: { dot: "bg-[#D389C2]", pill: "bg-[#D389C2] text-white" },
  其他: { dot: "bg-slate-300", pill: "bg-slate-500 text-white" },
};

function guessCategory(name: string): string {
  name = baseName(name);
  if (/3D筆|拼豆|黏土|水珠|氣球/i.test(name)) return "創意手作";
  if (/卡牌|桌遊|魔方|魔術|吸管|骨牌/i.test(name)) return "益智挑戰";
  if (/機械|科學|昆蟲|AI|積木/i.test(name)) return "STEAM啟航";
  if (/疊杯|卡林巴|舞蹈|體適能/i.test(name)) return "律動節奏";
  return "其他";
}

function representativesByBase(list: TemplateRowLite[]) {
  const map = new Map<string, TemplateRowLite[]>();
  list.forEach((t) => {
    const b = baseName(t.name);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(t);
  });
  const reps: TemplateRowLite[] = [];
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const na = tailNumber(a.name),
        nb = tailNumber(b.name);
      if (na === nb) return a.name.localeCompare(b.name, "zh-Hant");
      return na - nb;
    });
    reps.push(arr[0]);
  }
  return reps;
}

/* ---------------- Page ---------------- */
export default function BPage() {
  const supabase = useMemo<SupabaseClient>(() => getSupabase(), []);
  const router = useRouter();

  // ✅ 登入守門機制（Poster 免登入可跳過）
  useEffect(() => {
    const disabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_POSTER === "true";
    if (disabled) {
      console.log("[Poster] Auth disabled → skip login guard");
      return;
    }

    let canceled = false;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (canceled) return;

      const session = data?.session;
      if (!session || error) {
        const redirect = encodeURIComponent(
          (window.location.pathname + window.location.search) || "/edit"
        );
        router.replace(`/edit/login?redirect=${redirect}`);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [router, supabase]);

  // ---------------- 原本主程式開始 ----------------
  const [templates, setTemplates] = useState<TemplateRowLite[]>([]);
  const [picked, setPicked] = useState<TemplateRowLite | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const previewWrapOuterRef = useRef<HTMLDivElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState<number>(0);
  const [logo, setLogo] = useState<LogoState>({ url: null, isDefault: false });
  const [logoPos, setLogoPos] = useState({ x: 0, y: 0, size: 300 });

  // 初次載入模板
  useEffect(() => {
    (async () => {
      setLoading(true);
      const rows = await listTemplates();
      const mapped: TemplateRowLite[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        width: r.width,
        height: r.height,
        bg_path: r.bg_path,
        icon_path: r.icon_path ?? `icons/icon-${safeKey(r.name)}.png`,
        text_layers: r.text_layers,
      }));
      setTemplates(mapped);
      setLogo({ url: DEFAULT_LOGO, isDefault: true });
      setLoading(false);
    })();
  }, []);

  // 量測容器寬度（ResizeObserver）
  useEffect(() => {
    const el = previewWrapOuterRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWrapWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    setWrapWidth(el.clientWidth || 0);
    return () => ro.disconnect();
  }, []);

  /* ------- 工具 ------- */
  function getIconUrl(t: TemplateRowLite) {
    const path = t.icon_path!;
    const { data } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(encodeURI(path));
    return data?.publicUrl ?? placeholder;
  }

  /** 左下縮圖只抓背景 */
  function getThumbFromBg(t: TemplateRowLite) {
    const p = t.bg_path;
    if (!p) return placeholder;
    return /^https?:|^data:image\//.test(p) ? p : toPublicUrl(encodeURI(p));
  }

  function setFieldForLabel(match: RegExp, text: string) {
    if (!picked) return;
    const hit = picked.text_layers.find((l) => match.test(l.label));
    if (!hit) return;
    setValues((o) => ({ ...o, [hit.id]: text }));
  }

  function getFieldValue(fieldKey: FieldKey) {
    if (!picked) return "";
    const conf = FIELD_KEYS.find((f) => f.key === fieldKey);
    if (!conf) return "";
    const hit = picked.text_layers.find((l) => conf.match.test(l.label));
    return hit ? values[hit.id] ?? "" : "";
  }

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

  /* ---------------- 尺寸 / 拖曳 ---------------- */
  const w = picked?.width ?? 1080;
  const h = picked?.height ?? 1528;
  const scale = Math.min((wrapWidth > 0 ? wrapWidth : 480) / w, 1);

  const getStagePoint = (clientX: number, clientY: number) => {
    const rect = stageWrapRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

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

  /* --------- ✅ 切換模板會保留使用者輸入 --------- */
  function selectTemplate(nextTpl: TemplateRowLite) {
    // 1) 存下右側四個欄位目前值（依標籤正則）
    const currentForm: Partial<Record<FieldKey, string>> = {};
    for (const { key } of FIELD_KEYS) {
      currentForm[key] = getFieldValue(key) || "";
    }

    // 2) 存下「被使用者修改過」的文字層（以 label 為 key）
    const lastByLabel = new Map<string, string>();
    if (picked) {
      for (const L of picked.text_layers) {
        const v = values[L.id];
        if (v !== undefined && v !== L.text) {
          lastByLabel.set((L.label || "").trim(), v);
        }
      }
    }

    // 3) 生成新模板的初始 values
    const init: Record<string, string> = {};
    for (const L of nextTpl.text_layers) {
      const exact = lastByLabel.get((L.label || "").trim());
      if (exact != null) {
        init[L.id] = exact;
        continue;
      }
      const field = FIELD_KEYS.find((f) => f.match.test(L.label));
      if (field) {
        init[L.id] = (currentForm[field.key] ?? "") || L.text;
        continue;
      }
      init[L.id] = L.text;
    }

    setPicked(nextTpl);
    setValues(init);

    // Logo 規則：仍維持—只有當前是預設 Logo 才在換模板時清掉
    setLogo((prev) =>
      prev.isDefault ? { url: null, isDefault: false } : prev
    );
  }

  /* --------- 同系列模板切換（按名稱基底 + 尾碼排序） --------- */
  const siblings = React.useMemo(() => {
    if (!picked) return [] as TemplateRowLite[];
    const bn = baseName(picked.name);
    const same = templates.filter((t) => baseName(t.name) === bn);
    return same.sort((a, b) => {
      const na = tailNumber(a.name),
        nb = tailNumber(b.name);
      if (na === nb) return a.name.localeCompare(b.name, "zh-Hant");
      return na - nb;
    });
  }, [picked, templates]);

  /* --------- 右側選課（只顯示代表） --------- */
  const grouped = React.useMemo(() => {
    const reps = representativesByBase(templates);
    const map = new Map<string, TemplateRowLite[]>();
    for (const t of reps) {
      const cat = guessCategory(t.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    for (const v of map.values())
      v.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    const order = ["創意手作", "益智挑戰", "STEAM啟航", "律動節奏", "其他"];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ name: k, items: map.get(k)! }));
  }, [templates]);

  /* ---------------- 匯出：PNG / PDF ---------------- */
  async function getStageCanvas(scaleFactor = 3) {
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }

    const stage =
      stageWrapRef.current?.querySelector<HTMLDivElement>("[data-stage]");
    if (!stage) return null;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(stage, {
      scale: scaleFactor,
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
          cloned.style.fontFamily = `"GenYoGothicTW","Noto Sans TC",sans-serif`;
        }
      },
    });
    return canvas;
  }

  async function downloadPNG() {
    if (!stageWrapRef.current) return;
    const canvas = await getStageCanvas(3);
    if (!canvas) return;

    const schoolInput = getFieldValue("school");
    const courseBase = baseName(picked?.name ?? "未選模板");
    const fileName = `${toSafeFilename(schoolInput)}_${toSafeFilename(
      courseBase
    )}.png`;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png", 1.0);
    link.download = fileName;
    link.click();
  }

  async function downloadPDF() {
    if (!stageWrapRef.current) return;
    const canvas = await getStageCanvas(3);
    if (!canvas) return;

    const { jsPDF } = await import("jspdf");
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

    const schoolInput = getFieldValue("school");
    const courseBase = baseName(picked?.name ?? "未選模板");
    const fileName = `${toSafeFilename(schoolInput)}_${toSafeFilename(
      courseBase
    )}.pdf`;
    pdf.save(fileName);
  }

  /* ---------------- Render ---------------- */
  return (
    <div
      data-b-side
      className="min-h-screen flex flex-col bg-white font-[GenYoGothicTW]"
    >
      <main className="flex-1">
        <div className="max-w-[1180px] mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          {/* 左：預覽區 */}
          <div className="lg:col-span-5">
            <div className="mb-3 inline-flex items-center gap-2">
              <span className="inline-block px-4 py-1 rounded-full bg-black text-white text-[14px] font-bold shadow">
                海報預覽
              </span>
            </div>

            {/* 外層：負責量測寬度 */}
            <div ref={previewWrapOuterRef} className="w-full">
              {/* 內層：實際顯示框 */}
              <div
                className="relative mx-auto shadow rounded border border-slate-200 bg-white"
                style={{ width: "100%", height: Math.round(h * scale) }}
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
                    fontFamily: `"GenYoGothicTW","Noto Sans TC",sans-serif`,
                  }}
                >
                  {/* 文字層 */}
                  {picked &&
                    picked.text_layers.map((L) => {
                      const text =
                        values[L.id] !== undefined ? values[L.id] : L.text;

                      // ✅ 判斷是否為「補習班名稱」文字層
                      const isSchoolLayer =
                        /補習班|機構|班名|店名|名稱/i.test(L.label);

                      // 行高與字型大小基準
                      const baseFontSize = L.fontSize;
                      let renderFontSize = baseFontSize;
                      let lineHeight = 1.1;

                      const style: CSSProperties = {
                        position: "absolute",
                        left: L.x,
                        top: L.y,
                        width: Math.max(1, L.width),
                        color: L.color,
                        fontWeight: L.weight,
                        fontStyle: L.italic ? "italic" : "normal",
                        textAlign: L.align as any,
                        textTransform: L.uppercase ? "uppercase" : "none",
                        textShadow: L.shadow
                          ? "0 2px 6px rgba(0,0,0,.35)"
                          : "none",
                        zIndex: 10,
                      };

                      if (isSchoolLayer) {
                        // ✅ 只依照使用者手動換行（\n）來斷行
                        style.whiteSpace = "pre";
                        style.wordBreak = "keep-all";

                        // ✅ 根據手動行數縮小字型
                        const raw = (text ?? "").toString();
                        const lines = raw
                          .split(/\r?\n/)
                          .filter((l) => l.trim() !== "");
                        const lineCount = Math.max(lines.length, 1);
                        const maxLines = 3; // 最多給 3 行高度

                        const clamped = Math.min(lineCount, maxLines);
                        // 1 行：100%，2 行：88%，3 行：78%，再多就大約 1/行數
                        const scaleMap: Record<number, number> = {
                          1: 1,
                          2: 0.75,
                          3: 0.60
                        };
                        const scale =
                          scaleMap[clamped] ?? Math.max(0.6, 1 / clamped);

                        renderFontSize = Math.round(baseFontSize * scale);
                        lineHeight = 1.1;

                        style.maxHeight = renderFontSize * lineHeight * maxLines;
                        style.overflow = "hidden";
                      } else {
                        // 其他層維持原本換行行為
                        style.whiteSpace = "pre-wrap";
                        style.wordBreak = "break-word";
                      }

                      style.fontSize = renderFontSize;
                      style.lineHeight = lineHeight;

                      return (
                        <div
                          key={L.id}
                          className="absolute select-none px-1"
                          style={style}
                        >
                          {text}
                        </div>
                      );
                    })}

                  {/* Logo：預設不可拖曳/不可點；客戶 Logo 可拖曳 */}
                  {logo.url && (
                    <img
                      src={logo.url}
                      alt="Logo"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        position: "absolute",
                        left: logoPos.x,
                        top: logoPos.y,
                        width: logoPos.size,
                        height: "auto",
                        zIndex: 50,
                        cursor: logo.isDefault ? "default" : "grab",
                        pointerEvents: logo.isDefault ? "none" : "auto",
                        userSelect: "none",
                      }}
                      onMouseDown={(e) => {
                        if (logo.isDefault) return;
                        e.preventDefault();
                        const p = getStagePoint(e.clientX, e.clientY);
                        startDragLogo(p.x, p.y);
                      }}
                      onTouchStart={(e) => {
                        if (logo.isDefault) return;
                        const t = e.touches[0];
                        if (!t) return;
                        const p = getStagePoint(t.clientX, t.clientY);
                        startDragLogo(p.x, p.y);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 左下：同系列模板 */}
            {picked && siblings.length > 0 && (
              <div className="mt-6">
                <div className="text-[13px] mb-2 font-semibold text-slate-700">
                  選擇模板
                </div>
                <div className="flex gap-3">
                  {siblings.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className={`w-14 h-16 rounded-xl shadow border overflow-hidden ${
                        picked?.id === tpl.id ? "ring-2 ring-black" : ""
                      }`}
                      title={tpl.name}
                    >
                      <img
                        src={getThumbFromBg(tpl)}
                        onError={(e) =>
                          (e.currentTarget.src = placeholder)
                        }
                        className="w-full h-full object-cover"
                        alt={tpl.name}
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 上傳 / 控制 Logo */}
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
                    reader.onload = () => {
                      setLogo({
                        url: reader.result as string,
                        isDefault: false,
                      });
                      const W = picked?.width ?? 1080;
                      const H = picked?.height ?? 1528;
                      const S = 300;
                      setLogoPos({
                        x: (W - S) / 2,
                        y: (H - S) / 2,
                        size: S,
                      });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>

              {logo.url && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items中心 gap-2">
                    <label className="text-sm">大小：</label>
                    <input
                      type="range"
                      min="40"
                      max="320"
                      value={logoPos.size}
                      disabled={logo.isDefault}
                      onChange={(e) =>
                        setLogoPos((o) => ({
                          ...o,
                          size: +e.target.value,
                        }))
                      }
                      className="w-full sm:w-64"
                    />
                    <span className="text-xs text-slate-500">
                      {logoPos.size}px
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">位置：</span>
                    <div className="flex gap-2">
                      {[
                        {
                          k: "up",
                          fn: () =>
                            setLogoPos((o) => ({ ...o, y: o.y - 1 })),
                        },
                        {
                          k: "down",
                          fn: () =>
                            setLogoPos((o) => ({ ...o, y: o.y + 1 })),
                        },
                        {
                          k: "left",
                          fn: () =>
                            setLogoPos((o) => ({ ...o, x: o.x - 1 })),
                        },
                        {
                          k: "right",
                          fn: () =>
                            setLogoPos((o) => ({ ...o, x: o.x + 1 })),
                        },
                      ].map(({ k, fn }) => (
                        <button
                          key={k}
                          onClick={!logo.isDefault ? fn : undefined}
                          disabled={logo.isDefault}
                          className={`px-2 py-1 border rounded ${
                            logo.isDefault
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {k === "up"
                            ? "↑"
                            : k === "down"
                            ? "↓"
                            : k === "left"
                            ? "←"
                            : "→"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setLogo({ url: null, isDefault: false })
                      }
                      className="ml-0 sm:ml-3 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm shadow hover:bg-red-600 active:scale-95"
                    >
                      刪除 Logo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右：選課 + 表單 + 下載 */}
          <div className="lg:col-span-7">
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
                      CATEGORY_STYLES[grp.name] ??
                      CATEGORY_STYLES["其他"];
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
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {grp.items.map((t) => {
                            const iconUrl = getIconUrl(t);
                            return (
                              <button
                                key={t.id}
                                onClick={() => selectTemplate(t)}
                                className={`w-[72px] h-[72px] p-1 rounded-xl border hover:shadow transition flex items-center justify-center ${
                                  picked?.id === t.id
                                    ? "ring-2 ring-slate-900"
                                    : ""
                                } icon-tile`}
                                title={baseName(t.name)}
                              >
                                <img
                                  src={iconUrl}
                                  onError={(e) =>
                                    (e.currentTarget.src = placeholder)
                                  }
                                  className="w-[56px] h-[56px] object-contain"
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
                {FIELD_KEYS.map(({ key, match, label, multiline }) => (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-2 sm:gap-3"
                  >
                    <label className="w-full sm:w-32 text-sm text-slate-700">
                      {label}
                    </label>

                    {multiline ? (
                      <div className="flex-1 min-w-0">
                        <textarea
                          className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-slate-900/30 outline-none min-h-[72px]"
                          placeholder="請輸入…（可按 Enter 換行）"
                          value={
                            picked
                              ? (() => {
                                  const hit =
                                    picked.text_layers.find((l) =>
                                      match.test(l.label)
                                    );
                                  return hit ? values[hit.id] ?? "" : "";
                                })()
                              : ""
                          }
                          onChange={(e) =>
                            setFieldForLabel(match, e.target.value)
                          }
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          按 Enter 決定換行位置，海報會依行數自動縮小字型，最多約三行高度。
                        </p>
                      </div>
                    ) : (
                      <input
                        className="min-w-0 flex-1 w-full sm:w-auto px-3 py-2 rounded-lg border focus:ring-2 focus:ring-slate-900/30 outline-none"
                        placeholder="請輸入…"
                        value={
                          picked
                            ? (() => {
                                const hit =
                                  picked.text_layers.find((l) =>
                                    match.test(l.label)
                                  );
                                return hit ? values[hit.id] ?? "" : "";
                              })()
                            : ""
                        }
                        onChange={(e) =>
                          setFieldForLabel(match, e.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 下載：PNG / PDF */}
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                onClick={downloadPNG}
                className="px-6 py-3 rounded-full bg-slate-900 text-white font-semibold shadow active:scale-95 transition inline-flex items-center gap-2"
              >
                下載 PNG 圖檔
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v10" />
                  <path d="M8 10l4 4 4-4" />
                  <path d="M4 20h16" />
                </svg>
              </button>

              <button
                onClick={downloadPDF}
                className="px-6 py-3 rounded-full bg-slate-900 text-white font-semibold shadow active:scale-95 transition inline-flex items-center gap-2"
              >
                下載 PDF 列印
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v10" />
                  <path d="M8 10l4 4 4-4" />
                  <path d="M4 20h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-10 bg-[#FFC840] text-[11px] sm:text-[12px] text-white/90 py-3 text-center tracking-wider px-3">
        國王才藝 KING'S TALENT ｜本平台模板由國王才藝原創設計，僅限補教機構之招生宣傳使用，請勿轉售、重製或作商業用途。
      </footer>
    </div>
  );
}
