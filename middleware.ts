// middleware.ts  (專案根目錄)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO = "studio.kingstalent.com.tw"; // A 端
const POSTER = "poster.kingstalent.com.tw"; // B 端

export function middleware(req: NextRequest) {
  try {
    const url = req.nextUrl.clone();
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      url.hostname;

    const path = url.pathname;

    // ✅ 1) Auth/Next/API/靜態：直接放行，避免改寫 OAuth 回傳
    //    （雖然 matcher 也會排除，但這裡再早退最保險）
    if (
      path.startsWith("/auth/") ||
      path === "/auth" ||
      path.startsWith("/api/") ||
      path.startsWith("/_next/")
    ) {
      return NextResponse.next();
    }

    // ✅ 2) 子網域路由改寫
    // A 端：studio -> /studio(...)
    if (host === STUDIO || host.startsWith("studio.")) {
      if (!path.startsWith("/studio")) {
        url.pathname = "/studio" + (path === "/" ? "" : path);
        return NextResponse.rewrite(url); // query 會保留
      }
      return NextResponse.next();
    }

    // B 端：poster -> /edit(...)
    if (host === POSTER || host.startsWith("poster.")) {
      if (!path.startsWith("/edit")) {
        url.pathname = "/edit" + (path === "/" ? "" : path);
        return NextResponse.rewrite(url);
      }
      return NextResponse.next();
    }

    // 其他網域：不處理
    return NextResponse.next();
  } catch (e) {
    console.error("middleware error:", e);
    return NextResponse.next();
  }
}

// ✅ 3) matcher 也把 auth 排除，避免被攔
export const config = {
  matcher: [
    // 排除 auth/api/_next 及常見靜態檔案
    '/((?!auth/|api/|_next/|static/|public/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|txt|webmanifest|woff|woff2|ttf|otf|webp)$).*)',
  ],
};
