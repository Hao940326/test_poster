// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

function withHostCookie(resp: NextResponse, hostname: string) {
  const isPoster = hostname.includes("poster.");
  const isStudio = hostname.includes("studio.");

  if (isPoster) {
    resp.cookies.set("sb-host", "poster", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  } else if (isStudio) {
    resp.cookies.set("sb-host", "studio", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  }
  return resp;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = url.hostname;
  const path = url.pathname;

  // 1) 放行靜態 & Auth 回呼 & 登入頁
  if (
    path.startsWith("/_next") || path.startsWith("/static") ||
    path.startsWith("/favicon") || path.startsWith("/icon") ||
    path.startsWith("/apple-touch-icon") || path.startsWith("/robots.txt") ||
    path.startsWith("/sitemap.xml") || path.startsWith("/images") ||
    path.startsWith("/fonts") || path.startsWith("/public") ||
    path.startsWith("/auth/") || path.startsWith("/api/auth/") ||
    path.startsWith("/edit/auth/") || path.startsWith("/studio/auth/") ||
    path.startsWith("/studio/login") || path.startsWith("/edit/login")
  ) {
    return withHostCookie(NextResponse.next(), hostname);
  }

  // 2) Studio 子網域 → 永遠掛 /studio
  if (hostname === STUDIO_HOST || hostname.startsWith("studio.")) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return withHostCookie(NextResponse.rewrite(url), hostname);
    }
    return withHostCookie(NextResponse.next(), hostname);
  }

  // 3) Poster 子網域 → 永遠掛 /edit
  if (hostname === POSTER_HOST || hostname.startsWith("poster.")) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return withHostCookie(NextResponse.rewrite(url), hostname);
    }
    return withHostCookie(NextResponse.next(), hostname);
  }

  // 4) 其他網域（預覽/測試）
  return withHostCookie(NextResponse.next(), hostname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/|fonts/|public/|icon|apple-touch-icon).*)",
  ],
};
