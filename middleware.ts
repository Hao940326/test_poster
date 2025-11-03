// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = url.hostname;          // ← 比 headers.get("host") 穩
  const path = url.pathname;

  // 1) 永遠放行的路徑（靜態與 OAuth 回呼 & 登入頁）
  if (
    path.startsWith("/_next") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/api/auth") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/public") ||
    path.startsWith("/images") ||
    path.startsWith("/fonts") ||
    path.startsWith("/studio/login") ||   // A 端登入頁
    path.startsWith("/edit/login")        // B 端登入頁
  ) {
    return NextResponse.next();
  }

  // 2) A 端：固定掛在 /studio 底下
  if (hostname === STUDIO_HOST || hostname.startsWith("studio.")) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 3) B 端：固定掛在 /edit 底下
  if (hostname === POSTER_HOST || hostname.startsWith("poster.")) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 4) 其他網域（例如預覽/測試網域）→ 不處理
  return NextResponse.next();
}

// 只攔需要的請求；有副檔名的檔案與 Next 靜態資源不進 middleware
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/|public/).*)",
  ],
};
