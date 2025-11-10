// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl;

  // 1) 靜態與 API 放行，避免干擾
  const isExcluded =
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.startsWith("/api") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|webp|css|js)$/i);
  if (isExcluded) return NextResponse.next();

  const isStudio = host.startsWith("studio.");
  const isPoster = host.startsWith("poster.");

  // 2) poster.* → 永遠放行（只做分流/重寫，不做登入檢查）
  if (isPoster) {
    if (!url.pathname.startsWith("/edit")) {
      const nextUrl = url.clone();
      nextUrl.pathname = `/edit${url.pathname}`;
      return NextResponse.rewrite(nextUrl);
    }
    return NextResponse.next();
  }

  // 3) studio.* → 維持原本路徑分區（如有其它地方做登入檢查，照舊）
  if (isStudio) {
    if (!url.pathname.startsWith("/studio")) {
      const nextUrl = url.clone();
      nextUrl.pathname = `/studio${url.pathname}`;
      return NextResponse.rewrite(nextUrl);
    }

    // ⚠️ 如果你想在 middleware 內部做 Studio 的登入檢查，可在這裡加上：
    // const hasSession = req.cookies.get("sb-studio-at") || req.cookies.get("sb-studio");
    // if (!hasSession && !url.pathname.startsWith("/studio/login")) {
    //   const loginUrl = new URL("/studio/login", req.url);
    //   loginUrl.searchParams.set("redirect", url.pathname + url.search);
    //   return NextResponse.redirect(loginUrl);
    // }

    return NextResponse.next();
  }

  // 4) 其他網域 → 照常通過
  return NextResponse.next();
}

// 只攔需要的路徑（避免干擾資源）
export const config = {
  matcher: ["/((?!_next|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|css|js)).*)"],
};
