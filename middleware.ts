// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

// 跳過清單：靜態資源、Next 內部路徑、SEO 檔
const IGNORE_PREFIXES = [
  "/_next", "/api", "/favicon", "/robots", "/sitemap", "/static", "/assets",
  "/images", "/fonts"
];

function shouldIgnore(pathname: string) {
  return IGNORE_PREFIXES.some(p => pathname.startsWith(p));
}

// 子網域是否視為 studio/poster（支援 studio-xxx、poster-xxx）
function isStudioLike(host: string) {
  const sub = host.split(".")[0] || "";
  return sub === "studio" || sub.startsWith("studio-");
}
function isPosterLike(host: string) {
  const sub = host.split(".")[0] || "";
  return sub === "poster" || sub.startsWith("poster-");
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || url.hostname;
  const path = url.pathname;

  // 靜態或內部路徑：直接放行
  if (shouldIgnore(path)) {
    return NextResponse.next();
  }

  // 已經在正確前綴底下：放行（避免重覆加前綴）
  if (path.startsWith("/studio") || path.startsWith("/edit")) {
    return NextResponse.next();
  }

  // 1) 真正的自訂網域
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    url.pathname = "/studio" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    url.pathname = "/edit" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }

  // 2) Vercel 預覽網域：子網域以 studio / poster 開頭
  if (isStudioLike(host)) {
    url.pathname = "/studio" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }
  if (isPosterLike(host)) {
    url.pathname = "/edit" + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }

  // 3) 其他情況（例如普通 *.vercel.app 預覽）：不要亂重寫，直接放行，避免循環
  return NextResponse.next();
}

// 只在需要的路徑生效（可選）：
// export const config = { matcher: ["/((?!_next|api|favicon|robots|sitemap|static|assets|images|fonts).*)"] };
