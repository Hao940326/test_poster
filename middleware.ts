// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = url.hostname; // 比 headers.get("host") 穩定
  const path = url.pathname;

  /* ----------------------------------------
   * 1️⃣ 放行必要資源：Next.js 靜態資源 / Auth 回呼 / 登入頁
   * ---------------------------------------- */
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/favicon") ||
    path.startsWith("/icon") ||
    path.startsWith("/apple-touch-icon") ||
    path.startsWith("/robots.txt") ||
    path.startsWith("/sitemap.xml") ||
    path.startsWith("/images") ||
    path.startsWith("/fonts") ||
    path.startsWith("/public") ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/studio/login") ||
    path.startsWith("/edit/login")
  ) {
    return NextResponse.next();
  }

  /* ----------------------------------------
   * 2️⃣ Studio 子網域 → 永遠掛在 /studio 下
   * ---------------------------------------- */
  if (hostname === STUDIO_HOST || hostname.startsWith("studio.")) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ----------------------------------------
   * 3️⃣ Poster 子網域 → 永遠掛在 /edit 下
   * ---------------------------------------- */
  if (hostname === POSTER_HOST || hostname.startsWith("poster.")) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  /* ----------------------------------------
   * 4️⃣ 其他網域（預覽或測試）→ 不處理
   * ---------------------------------------- */
  return NextResponse.next();
}

/* ----------------------------------------
 * ✅ Matcher：排除靜態資源與公共檔案，避免被 rewrite
 * ---------------------------------------- */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/|public/|icon|apple-touch-icon).*)",
  ],
};
