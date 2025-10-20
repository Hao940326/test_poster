// middleware.ts  (放在專案根目錄，不是在 app/ 裡)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO = "studio.kingstalent.com.tw"; // A 端子網域
const POSTER = "poster.kingstalent.com.tw"; // B 端子網域

export function middleware(req: NextRequest) {
  try {
    const url = req.nextUrl.clone();

    // 在 Vercel edge 上 host 可能在 x-forwarded-host
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      url.hostname;

    const path = url.pathname;

    // ---- A 端：studio -> /studio(...)
    if (host === STUDIO || host.startsWith("studio.")) {
      if (!path.startsWith("/studio")) {
        url.pathname = "/studio" + (path === "/" ? "" : path);
        // 保留 query
        return NextResponse.rewrite(url);
      }
      return NextResponse.next();
    }

    // ---- B 端：poster -> /edit(...)
    if (host === POSTER || host.startsWith("poster.")) {
      if (!path.startsWith("/edit")) {
        url.pathname = "/edit" + (path === "/" ? "" : path);
        return NextResponse.rewrite(url);
      }
      return NextResponse.next();
    }

    // 其他網域／主網域：不處理
    return NextResponse.next();
  } catch (e) {
    // 避免邊緣節點直接 500
    console.error("middleware error:", e);
    return NextResponse.next();
  }
}

// 只攔頁面，避開 _next / 靜態檔 / API，避免遞迴或資源被攔
export const config = {
  matcher: [
    "/((?!api|_next|static|public|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|txt|webmanifest|woff|woff2|ttf|otf|webp)).*)",
  ],
};
