// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 你的正式網域
const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

// 不要攔的路徑（靜態/內部）
const IGNORE_PREFIXES = [
  "/_next", "/api", "/favicon", "/robots", "/sitemap",
  "/static", "/assets", "/images", "/fonts"
];
const shouldIgnore = (p: string) => IGNORE_PREFIXES.some(x => p.startsWith(x));

// 將 host 解析成「A 端 / B 端 / 不確定」— 支援 vercel 預覽子網域
function resolveArea(host: string): "studio" | "poster" | null {
  const sub = (host.split(".")[0] || "").toLowerCase();
  if (host === STUDIO_HOST || sub === "studio" || sub.startsWith("studio-")) return "studio";
  if (host === POSTER_HOST || sub === "poster" || sub.startsWith("poster-")) return "poster";
  return null; // 其他 *.vercel.app 或本機開發：不強制對應
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || url.hostname;
  const path = url.pathname;

  if (shouldIgnore(path)) return NextResponse.next();

  const area = resolveArea(host);

  // 已在各自區段就放行，避免重覆加前綴
  if (path.startsWith("/studio") || path.startsWith("/edit")) {
    // 關鍵：禁止「A端主機 + /edit」或「B端主機 + /studio」的交叉
    if (area === "studio" && path.startsWith("/edit")) {
      url.pathname = "/studio";
      return NextResponse.rewrite(url);
    }
    if (area === "poster" && path.startsWith("/studio")) {
      url.pathname = "/edit";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 明確只做「A→/studio」、「B→/edit」，其他一律放行（避免非預期跳轉）
  if (area === "studio") {
    url.pathname = "/studio" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }
  if (area === "poster") {
    url.pathname = "/edit" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }

  // 其餘情況（未判定區域的預覽網域/本機）不處理
  return NextResponse.next();
}

// 只在需要的路徑套用（可選）
export const config = {
  matcher: ["/((?!_next|api|favicon|robots|sitemap|static|assets|images|fonts).*)"]
};
